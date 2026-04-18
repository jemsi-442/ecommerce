import assert from "node:assert/strict";
import crypto from "crypto";
import test, { after, before } from "node:test";

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.AUTO_BOOTSTRAP_ADMIN = "false";
process.env.DISABLE_RIDER_TIMEOUT_JOB = "true";
process.env.SNIPPE_API_KEY = process.env.SNIPPE_API_KEY || "test_snippe_api_key";
process.env.SNIPPE_WEBHOOK_SECRET =
  process.env.SNIPPE_WEBHOOK_SECRET || "test_snippe_webhook_secret";
process.env.SNIPPE_BASE_URL = "https://mock.snippe.test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-jwt-secret";

const runId = Date.now();
const testEmail = `integration_${runId}@example.com`;
const vendorRegisterEmail = `vendor_register_${runId}@example.com`;
const testSku = `INT-TEST-${runId}`;
const adminEmail = `admin_integration_${runId}@example.com`;
const vendorSku = `VENDOR-TEST-${runId}`;
const vendorRejectedSku = `VENDOR-REJECT-${runId}`;
const originalFetch = global.fetch.bind(global);
const mockPayments = new Map();
let paymentCounter = 0;
let lastCreatePaymentRequest = null;
let lastPushPaymentReference = null;
let vendorProductId = null;

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

global.fetch = async (input, init = {}) => {
  const requestUrl = typeof input === "string" ? input : input.url;
  const requestMethod = String(init?.method || "GET").toUpperCase();

  if (!requestUrl.startsWith(process.env.SNIPPE_BASE_URL)) {
    return originalFetch(input, init);
  }

  if (requestMethod === "POST" && requestUrl === `${process.env.SNIPPE_BASE_URL}/v1/payments`) {
    const requestBody = JSON.parse(String(init.body || "{}"));
    lastCreatePaymentRequest = requestBody;

    const reference = `SNIPPE-TEST-${String(++paymentCounter).padStart(4, "0")}`;
    const payment = {
      reference,
      status: "pending",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      amount: {
        value: requestBody.details?.amount ?? 0,
        currency: requestBody.details?.currency || "TZS",
      },
      channel: {
        provider: requestBody.metadata?.requested_network || "snippe",
      },
      metadata: requestBody.metadata || {},
    };

    mockPayments.set(reference, payment);
    return jsonResponse({ data: payment });
  }

  if (requestMethod === "GET" && requestUrl.startsWith(`${process.env.SNIPPE_BASE_URL}/v1/payments/`)) {
    const reference = decodeURIComponent(requestUrl.split("/v1/payments/")[1] || "");
    const payment = mockPayments.get(reference);

    if (!payment) {
      return jsonResponse(
        {
          status: "error",
          message: "Payment not found",
        },
        404
      );
    }

    return jsonResponse({ data: payment });
  }

  if (requestMethod === "POST" && requestUrl.endsWith("/push")) {
    const reference = decodeURIComponent(
      requestUrl.split("/v1/payments/")[1]?.replace(/\/push$/, "") || ""
    );
    const payment = mockPayments.get(reference);

    if (!payment) {
      return jsonResponse(
        {
          status: "error",
          message: "Payment not found",
        },
        404
      );
    }

    lastPushPaymentReference = reference;
    return jsonResponse({
      data: {
        ...payment,
        status: "pending",
      },
    });
  }

  return jsonResponse(
    {
      status: "error",
      message: `Unhandled mock Snippe request: ${requestMethod} ${requestUrl}`,
    },
    500
  );
};

const sequelize = (await import("../config/db.js")).default;
const { runMigrations } = await import("../utils/migrations.js");
const { resetRateLimitBuckets } = await import("../middleware/rateLimiter.js");
const { startServer } = await import("../index.js");
const { AuditLog, Notification, Order, OrderItem, Product, ProductReview, User } = await import("../models/index.js");


let serverControl = null;
let baseUrl = "";
let product = null;

const api = async (pathname, { method = "GET", token, body, headers = {} } = {}) => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  return {
    status: response.status,
    body: payload,
  };
};

const signSnippeWebhookPayload = (payload) => {
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHmac("sha256", process.env.SNIPPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return {
    rawBody,
    timestamp,
    signature,
  };
};

const waitForNotificationEvent = async ({
  baseUrl,
  token,
  audience = "customer",
  timeoutMs = 5000,
}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${baseUrl}/api/notifications/stream?audience=${encodeURIComponent(audience)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      }
    );

    assert.equal(response.status, 200);
    assert.ok(response.body);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        throw new Error("Notification stream closed before an event was received");
      }

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        const eventMatch = block.match(/event:\s*([^\n]+)/);
        const dataMatch = block.match(/data:\s*(.+)/s);

        if (!eventMatch || !dataMatch) {
          continue;
        }

        if (eventMatch[1].trim() !== "notification") {
          continue;
        }

        await reader.cancel().catch(() => {});
        return JSON.parse(dataMatch[1].trim());
      }
    }
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Timed out while waiting for notification stream event");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
  }
};

const cleanupTestData = async () => {
  const user = await User.findOne({ where: { email: testEmail } });
  const orderIds = user
    ? (
        await Order.findAll({
          where: { userId: user.id },
          attributes: ["id"],
        })
      ).map((order) => order.id)
    : [];

  if (orderIds.length) {
    await AuditLog.destroy({ where: { orderId: orderIds } });
    await Notification.destroy({ where: { orderId: orderIds } });
    await ProductReview.destroy({ where: { orderId: orderIds } });
    await OrderItem.destroy({ where: { orderId: orderIds } });
    await Order.destroy({ where: { id: orderIds } });
  }

  await User.destroy({ where: { email: [testEmail, adminEmail, vendorRegisterEmail] } });
  await Product.destroy({ where: { sku: [testSku, vendorSku, vendorRejectedSku] } });
};

before(async () => {
  await sequelize.authenticate();
  await runMigrations({
    logger: {
      log() {},
    },
  });

  await cleanupTestData();

  await User.create({
    name: "Integration Admin",
    email: adminEmail,
    password: "Password123!",
    role: "admin",
    active: true,
  });

  product = await Product.create({
    name: "Integration Test Product",
    description: "Used by the automated order/payment integration test.",
    price: 700,
    stock: 5,
    sku: testSku,
    status: "approved",
  });

  serverControl = await startServer({
    port: 0,
    bootstrapAdmin: false,
    startBackgroundJobs: false,
  });

  baseUrl = `http://127.0.0.1:${serverControl.server.address().port}`;
});

after(async () => {
  try {
    await cleanupTestData();
  } finally {
    if (serverControl) {
      await serverControl.close();
    }

    global.fetch = originalFetch;
    await sequelize.close();
  }
});

test("auth, order creation, and Snippe webhook flow stays healthy", async (t) => {
  let token = "";
  let adminToken = "";
  let createdOrderId = null;
  let createdOrderReference = "";

  await t.test("registers and logs in a customer", async () => {
    resetRateLimitBuckets();

    const registerResponse = await api("/api/auth/register", {
      method: "POST",
      body: {
        name: "Integration Test User",
        email: testEmail,
        phone: "+255700111222",
        password: "Password123!",
        role: "client",
      },
    });

    assert.equal(registerResponse.status, 201);
    assert.equal(registerResponse.body.email, testEmail);
    assert.equal(registerResponse.body.phone, "+255700111222");
    assert.equal(registerResponse.body.role, "customer");
    assert.ok(registerResponse.body.createdAt);
    assert.ok(registerResponse.body.token);

    const loginResponse = await api("/api/auth/login", {
      method: "POST",
      body: {
        email: testEmail,
        password: "Password123!",
      },
    });

    assert.equal(loginResponse.status, 200);
    assert.equal(loginResponse.body.email, testEmail);
    assert.equal(loginResponse.body.phone, "+255700111222");
    assert.ok(loginResponse.body.createdAt);
    assert.ok(loginResponse.body.token);
    token = loginResponse.body.token;

    const adminLoginResponse = await api("/api/auth/login", {
      method: "POST",
      body: {
        email: adminEmail,
        password: "Password123!",
      },
    });

    assert.equal(adminLoginResponse.status, 200);
    assert.equal(adminLoginResponse.body.role, "admin");
    adminToken = adminLoginResponse.body.token;
  });

  await t.test("registers a vendor directly with phone and starter store profile", async () => {
    resetRateLimitBuckets();

    const registerResponse = await api("/api/auth/register", {
      method: "POST",
      body: {
        name: "Vendor Register User",
        email: vendorRegisterEmail,
        phone: "+255744555666",
        password: "Password123!",
        role: "vendor",
      },
    });

    assert.equal(registerResponse.status, 201);
    assert.equal(registerResponse.body.email, vendorRegisterEmail);
    assert.equal(registerResponse.body.phone, "+255744555666");
    assert.equal(registerResponse.body.role, "vendor");
    assert.ok(registerResponse.body.createdAt);

    const vendorUser = await User.findOne({ where: { email: vendorRegisterEmail } });
    assert.ok(vendorUser);
    assert.equal(vendorUser.role, "vendor");
    assert.equal(vendorUser.phone, "+255744555666");
    assert.equal(vendorUser.businessPhone, "+255744555666");
    assert.equal(vendorUser.storeName, "Vendor Register User");
    assert.match(String(vendorUser.storeSlug || ""), /^vendor-register-user(?:-\d+)?$/);
  });

  await t.test("blocks converting an admin account into a vendor", async () => {
    const adminUser = await User.findOne({ where: { email: adminEmail } });
    assert.ok(adminUser);

    const updateRoleResponse = await api(`/api/users/${adminUser.id}/role`, {
      method: "PATCH",
      token: adminToken,
      body: { role: "vendor" },
    });

    assert.equal(updateRoleResponse.status, 403);
    assert.match(updateRoleResponse.body.message || "", /admin accounts cannot be reassigned/i);

    await adminUser.reload();
    assert.equal(adminUser.role, "admin");
  });

  await t.test("syncs saved products to the customer account", async () => {
    const emptySavedProductsResponse = await api("/api/users/me/saved-products", {
      method: "GET",
      token,
    });

    assert.equal(emptySavedProductsResponse.status, 200);
    assert.equal(emptySavedProductsResponse.body.data.count, 0);

    const saveProductsResponse = await api("/api/users/me/saved-products", {
      method: "PUT",
      token,
      body: {
        productIds: [product.id, 999999],
      },
    });

    assert.equal(saveProductsResponse.status, 200);
    assert.deepEqual(saveProductsResponse.body.data.productIds, [Number(product.id)]);
    assert.equal(saveProductsResponse.body.data.count, 1);
    assert.equal(Number(saveProductsResponse.body.data.items[0]._id), Number(product.id));

    const profileResponse = await api("/api/users/me", {
      method: "GET",
      token,
    });

    assert.equal(profileResponse.status, 200);
    assert.deepEqual(profileResponse.body.data.savedProductIds, [Number(product.id)]);

    const clearSavedProductsResponse = await api("/api/users/me/saved-products", {
      method: "PUT",
      token,
      body: {
        productIds: [],
      },
    });

    assert.equal(clearSavedProductsResponse.status, 200);
    assert.equal(clearSavedProductsResponse.body.data.count, 0);
  });

  await t.test("allows an admin to promote a customer to vendor and use vendor tools", async () => {
    const createdCustomer = await User.findOne({ where: { email: testEmail } });

    const updateRoleResponse = await api(`/api/users/${createdCustomer.id}/role`, {
      method: "PATCH",
      token: adminToken,
      body: { role: "vendor" },
    });

    assert.equal(updateRoleResponse.status, 200);
    assert.equal(updateRoleResponse.body.role, "vendor");

    const vendorProfileResponse = await api("/api/vendor/profile", {
      method: "PATCH",
      token,
      body: {
        storeName: "Integration Vendor Store",
        storeSlug: "integration-vendor-store",
        businessPhone: "0683186987",
        businessDescription: "A vendor profile used by automated integration tests.",
      },
    });

    assert.equal(vendorProfileResponse.status, 200);
    assert.equal(vendorProfileResponse.body.data.storeName, "Integration Vendor Store");
    assert.equal(vendorProfileResponse.body.data.storeSlug, "integration-vendor-store");

    const createVendorProductResponse = await api("/api/vendor/products", {
      method: "POST",
      token,
      body: {
        name: "Vendor Integration Product",
        description: "Vendor-owned product created during the integration suite.",
        price: 1500,
        stock: 3,
        sku: vendorSku,
        image: "https://example.com/vendor-product.jpg",
      },
    });

    assert.equal(createVendorProductResponse.status, 201);
    assert.equal(createVendorProductResponse.body.data.status, "pending");
    assert.equal(Number(createVendorProductResponse.body.data.createdBy), Number(createdCustomer.id));

    const createRejectedVendorProductResponse = await api("/api/vendor/products", {
      method: "POST",
      token,
      body: {
        name: "Vendor Product Needing Changes",
        description: "This product will be rejected during the moderation test.",
        price: 2400,
        stock: 2,
        sku: vendorRejectedSku,
        image: "https://example.com/vendor-product-rejected.jpg",
      },
    });

    assert.equal(createRejectedVendorProductResponse.status, 201);
    assert.equal(createRejectedVendorProductResponse.body.data.status, "pending");

    const approveVendorProductResponse = await api(
      `/api/products/${createVendorProductResponse.body.data._id}/approve`,
      {
        method: "PUT",
        token: adminToken,
        body: { reviewNotes: "Approved for the storefront after review." },
      }
    );

    assert.equal(approveVendorProductResponse.status, 200);
    assert.equal(approveVendorProductResponse.body.data.status, "approved");
    assert.equal(approveVendorProductResponse.body.data.vendor.storeSlug, "integration-vendor-store");
    vendorProductId = approveVendorProductResponse.body.data._id;
    assert.equal(
      approveVendorProductResponse.body.data.reviewNotes,
      "Approved for the storefront after review."
    );

    const rejectVendorProductResponse = await api(
      `/api/products/${createRejectedVendorProductResponse.body.data._id}/reject`,
      {
        method: "PUT",
        token: adminToken,
        body: {
          reviewNotes: "Please add clearer photos and a fuller description before approval.",
        },
      }
    );

    assert.equal(rejectVendorProductResponse.status, 200);
    assert.equal(rejectVendorProductResponse.body.data.status, "rejected");
    assert.match(
      rejectVendorProductResponse.body.data.reviewNotes,
      /clearer photos/i
    );

    const vendorProductsResponse = await api("/api/vendor/products", {
      method: "GET",
      token,
    });

    assert.equal(vendorProductsResponse.status, 200);
    assert.ok(
      vendorProductsResponse.body.data.items.some((item) => item.sku === vendorSku && item.status === "approved")
    );
    assert.ok(
      vendorProductsResponse.body.data.items.some(
        (item) =>
          item.sku === vendorRejectedSku &&
          item.status === "rejected" &&
          /clearer photos/i.test(item.reviewNotes || "")
      )
    );

    const storefrontResponse = await api("/api/stores/integration-vendor-store");
    assert.equal(storefrontResponse.status, 200);
    assert.equal(storefrontResponse.body.data.store.storeSlug, "integration-vendor-store");
    assert.ok(
      storefrontResponse.body.data.items.some((item) => item.sku === vendorSku)
    );
    assert.ok(
      !storefrontResponse.body.data.items.some((item) => item.sku === vendorRejectedSku)
    );

    const emptyFavoriteStoresResponse = await api("/api/users/me/favorite-stores", {
  method: "GET",
  token,
});

assert.equal(emptyFavoriteStoresResponse.status, 200);
assert.equal(emptyFavoriteStoresResponse.body.data.count, 0);

const saveFavoriteStoresResponse = await api("/api/users/me/favorite-stores", {
  method: "PUT",
  token,
  body: {
    storeSlugs: ["integration-vendor-store", "missing-store"],
  },
});

assert.equal(saveFavoriteStoresResponse.status, 200);
assert.deepEqual(saveFavoriteStoresResponse.body.data.storeSlugs, ["integration-vendor-store"]);
assert.equal(saveFavoriteStoresResponse.body.data.count, 1);
assert.equal(saveFavoriteStoresResponse.body.data.items[0].storeSlug, "integration-vendor-store");

const profileResponse = await api("/api/users/me", {
  method: "GET",
  token,
});

assert.equal(profileResponse.status, 200);
assert.deepEqual(profileResponse.body.data.favoriteStoreSlugs, ["integration-vendor-store"]);

const clearFavoriteStoresResponse = await api("/api/users/me/favorite-stores", {
  method: "PUT",
  token,
  body: {
    storeSlugs: [],
  },
});

assert.equal(clearFavoriteStoresResponse.status, 200);
assert.equal(clearFavoriteStoresResponse.body.data.count, 0);

const updatedCustomer = await User.findByPk(createdCustomer.id);
    assert.equal(updatedCustomer.role, "vendor");

    updatedCustomer.role = "customer";
    await updatedCustomer.save();
  });

  await t.test("rejects a mismatched phone and network before stock is touched", async () => {
    const productBefore = await Product.findByPk(product.id);

    const mismatchResponse = await api("/api/orders", {
      method: "POST",
      token,
      body: {
        items: [{ productId: product.id, quantity: 1 }],
        delivery: {
          type: "home",
          address: "Mbezi Beach, Dar es Salaam",
          contactPhone: "0683186987",
        },
        payment: {
          method: "mobile_money",
          network: "mpesa",
        },
      },
    });

    assert.equal(mismatchResponse.status, 400);
    assert.match(mismatchResponse.body.message, /M-Pesa|network|prefix/i);

    const productAfter = await Product.findByPk(product.id);
    assert.equal(Number(productAfter.stock), Number(productBefore.stock));
  });

  await t.test("creates a mobile money order and reserves inventory", async () => {
    const notificationEventPromise = waitForNotificationEvent({
      baseUrl,
      token,
      audience: "customer",
    });

    const createOrderResponse = await api("/api/orders", {
      method: "POST",
      token,
      body: {
        items: [{ productId: product.id, quantity: 1 }],
        delivery: {
          type: "home",
          address: "Mbezi Beach, Dar es Salaam",
          contactPhone: "0683186987",
        },
        payment: {
          method: "mobile_money",
          network: "airtel_money",
        },
      },
    });

    assert.equal(createOrderResponse.status, 201);
    assert.equal(createOrderResponse.body.payment.method, "mobile_money");
    assert.equal(createOrderResponse.body.payment.provider, "airtel_money");
    assert.equal(createOrderResponse.body.payment.status, "pending");
    assert.equal(createOrderResponse.body.paymentIntent.status, "pending");
    assert.equal(lastCreatePaymentRequest.metadata.requested_network, "airtel_money");
    assert.equal(lastCreatePaymentRequest.phone_number, "255683186987");

    createdOrderId = createOrderResponse.body._id;
    createdOrderReference = createOrderResponse.body.payment.reference;
    const notificationEvent = await notificationEventPromise;

    const orderRecord = await Order.findByPk(createdOrderId);
    const productAfter = await Product.findByPk(product.id);

    assert.ok(createdOrderReference);
    assert.equal(notificationEvent.audience, "customer");
    assert.equal(notificationEvent.type, "customer_payment_pending");
    assert.equal(Number(notificationEvent.orderId), Number(createdOrderId));
    assert.equal(orderRecord.inventoryReserved, true);
    assert.equal(Number(productAfter.stock), 4);
  });

  await t.test("retries the mobile money prompt on the existing Snippe reference", async () => {
    lastPushPaymentReference = null;

    const retryPaymentResponse = await api(`/api/orders/${createdOrderId}/payment-push`, {
      method: "POST",
      token,
      body: {
        network: "airtel_money",
      },
    });

    assert.equal(retryPaymentResponse.status, 200);
    assert.equal(retryPaymentResponse.body.message, "Mobile money prompt resent");
    assert.equal(retryPaymentResponse.body.paymentIntent.reference, createdOrderReference);
    assert.equal(retryPaymentResponse.body.paymentIntent.provider, "airtel_money");
    assert.equal(retryPaymentResponse.body.paymentIntent.status, "pending");
    assert.equal(lastPushPaymentReference, createdOrderReference);

    const refreshedOrder = await Order.findByPk(createdOrderId);
    assert.equal(refreshedOrder.paymentReference, createdOrderReference);
    assert.equal(refreshedOrder.paymentProvider, "airtel_money");
    assert.equal(refreshedOrder.paymentStatus, "pending");
  });

  await t.test("accepts a signed Snippe webhook and marks the order paid", async () => {
    const webhookPayload = {
      type: "payment.completed",
      data: {
        reference: createdOrderReference,
        status: "completed",
        amount: {
          value: 700,
          currency: "TZS",
        },
        channel: {
          provider: "airtel_money",
        },
        metadata: {
          order_id: String(createdOrderId),
        },
      },
    };

    const signedPayload = signSnippeWebhookPayload(webhookPayload);
    const webhookResponse = await fetch(`${baseUrl}/api/payments/snippe/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Timestamp": signedPayload.timestamp,
        "X-Webhook-Signature": signedPayload.signature,
      },
      body: signedPayload.rawBody,
    });

    assert.equal(webhookResponse.status, 200);

    const paidOrder = await Order.findByPk(createdOrderId);
    const createdNotifications = await Notification.findAll({
      where: { orderId: createdOrderId },
      order: [["created_at", "ASC"]],
    });
    const auditLogs = await AuditLog.findAll({
      where: { orderId: createdOrderId },
      order: [["created_at", "ASC"]],
    });
    const auditActions = auditLogs.map((entry) => entry.action);
    const notificationTypes = createdNotifications.map((entry) => `${entry.audience}:${entry.type}`);

    assert.equal(paidOrder.isPaid, true);
    assert.equal(paidOrder.paymentStatus, "completed");
    assert.equal(paidOrder.paymentReference, createdOrderReference);
    assert.ok(["paid", "out_for_delivery"].includes(paidOrder.status));
    assert.ok(notificationTypes.includes("customer:customer_payment_pending"));
    assert.ok(notificationTypes.includes("admin:admin_payment_pending"));
    assert.ok(notificationTypes.includes("customer:customer_payment_completed"));
    assert.ok(notificationTypes.includes("admin:admin_payment_completed"));
    assert.ok(auditActions.includes("snippe_webhook_received"));
    assert.ok(auditActions.includes("snippe_payment_completed"));
  });

  await t.test("allows a delivered shopper to create and update a verified product review", async () => {
    const moveToDeliveryResponse = await api(`/api/orders/${createdOrderId}/status`, {
      method: "PUT",
      token: adminToken,
      body: { status: "out_for_delivery" },
    });

    assert.ok([200, 400].includes(moveToDeliveryResponse.status));
    if (moveToDeliveryResponse.status === 400) {
      assert.match(moveToDeliveryResponse.body.message || "", /invalid transition out_for_delivery → out_for_delivery/i);
    }

    const deliverOrderResponse = await api(`/api/orders/${createdOrderId}/status`, {
      method: "PUT",
      token: adminToken,
      body: { status: "delivered" },
    });

    assert.equal(deliverOrderResponse.status, 200);

    const createReviewResponse = await api(`/api/products/${product.id}/reviews`, {
      method: "POST",
      token,
      body: {
        rating: 5,
        title: "Worth buying",
        comment: "Delivery was smooth and the product matched the listing really well.",
      },
    });

    assert.equal(createReviewResponse.status, 201);
    assert.equal(createReviewResponse.body.data.summary.reviewCount, 1);
    assert.equal(createReviewResponse.body.data.summary.averageRating, 5);
    assert.equal(createReviewResponse.body.data.items.length, 1);
    assert.equal(createReviewResponse.body.data.userReview.rating, 5);

    const reviewFeedResponse = await api(`/api/products/${product.id}/reviews`, {
      method: "GET",
      token,
    });

    assert.equal(reviewFeedResponse.status, 200);
    assert.equal(reviewFeedResponse.body.data.canReview, true);
    assert.equal(reviewFeedResponse.body.data.hasPurchased, true);
    assert.equal(reviewFeedResponse.body.data.summary.reviewCount, 1);
    assert.equal(reviewFeedResponse.body.data.items[0].title, "Worth buying");

    const productDetailsResponse = await api(`/api/products/${product.id}`, {
      method: "GET",
      token,
    });

    assert.equal(productDetailsResponse.status, 200);
    assert.equal(productDetailsResponse.body.data.reviewCount, 1);
    assert.equal(productDetailsResponse.body.data.averageRating, 5);
    assert.equal(productDetailsResponse.body.data.reviews.length, 1);

    const updateReviewResponse = await api(`/api/products/${product.id}/reviews`, {
      method: "POST",
      token,
      body: {
        rating: 4,
        title: "Still a strong pick",
        comment: "Still happy with it after delivery, just not a perfect score for me.",
      },
    });

    assert.equal(updateReviewResponse.status, 200);
    assert.equal(updateReviewResponse.body.data.summary.reviewCount, 1);
    assert.equal(updateReviewResponse.body.data.summary.averageRating, 4);
    assert.equal(updateReviewResponse.body.data.userReview.rating, 4);

    const storedReviewCount = await ProductReview.count({
      where: {
        productId: product.id,
      },
    });

    assert.equal(storedReviewCount, 1);
  });

  await t.test("shows vendor order earnings and payout status for vendor-owned items", async () => {
    assert.ok(vendorProductId);

    const createVendorOrderResponse = await api("/api/orders", {
      method: "POST",
      token,
      body: {
        items: [{ productId: vendorProductId, quantity: 1 }],
        delivery: {
          type: "home",
          address: "Mikocheni, Dar es Salaam",
          contactPhone: "0683186987",
        },
        payment: {
          method: "mobile_money",
          network: "airtel_money",
        },
      },
    });

    assert.equal(createVendorOrderResponse.status, 201);
    const vendorOrderId = createVendorOrderResponse.body._id;
    const vendorOrderReference = createVendorOrderResponse.body.payment.reference;

    const vendorWebhookPayload = {
      type: "payment.completed",
      data: {
        reference: vendorOrderReference,
        status: "completed",
        amount: {
          value: 1500,
          currency: "TZS",
        },
        channel: {
          provider: "airtel_money",
        },
        metadata: {
          order_id: String(vendorOrderId),
        },
      },
    };

    const signedVendorPayload = signSnippeWebhookPayload(vendorWebhookPayload);
    const vendorWebhookResponse = await fetch(`${baseUrl}/api/payments/snippe/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Timestamp": signedVendorPayload.timestamp,
        "X-Webhook-Signature": signedVendorPayload.signature,
      },
      body: signedVendorPayload.rawBody,
    });

    assert.equal(vendorWebhookResponse.status, 200);

    const createdCustomer = await User.findOne({ where: { email: testEmail } });
    const promoteVendorResponse = await api(`/api/users/${createdCustomer.id}/role`, {
      method: "PATCH",
      token: adminToken,
      body: { role: "vendor" },
    });

    assert.equal(promoteVendorResponse.status, 200);

    const vendorOrdersResponse = await api("/api/vendor/orders", {
      method: "GET",
      token,
    });

    assert.equal(vendorOrdersResponse.status, 200);
    assert.ok(vendorOrdersResponse.body.data.summary.totalOrders >= 1);
    assert.ok(vendorOrdersResponse.body.data.summary.projectedPayout >= 1500);

    const vendorOrder = vendorOrdersResponse.body.data.items.find((item) => item._id === vendorOrderId);
    assert.ok(vendorOrder);
    assert.equal(vendorOrder.vendorSummary.payoutStatus, "processing");
    assert.equal(vendorOrder.vendorSummary.estimatedPayout, 1500);
    assert.equal(vendorOrder.payment.reference, vendorOrderReference);
    assert.equal(vendorOrder.payment.status, "completed");
    assert.ok(vendorOrder.items.some((item) => item.lineTotal === 1500));
    assert.ok(vendorOrder.items.some((item) => item.estimatedPayout === 1500));

    const revertRoleResponse = await api(`/api/users/${createdCustomer.id}/role`, {
      method: "PATCH",
      token: adminToken,
      body: { role: "customer" },
    });

    assert.equal(revertRoleResponse.status, 200);
  });

  await t.test("creates and pays out a vendor settlement record after delivery", async () => {
    assert.ok(vendorProductId);

    const createVendorOrderResponse = await api("/api/orders", {
      method: "POST",
      token,
      body: {
        items: [{ productId: vendorProductId, quantity: 1 }],
        delivery: {
          type: "home",
          address: "Masaki, Dar es Salaam",
          contactPhone: "0683186987",
        },
        payment: {
          method: "mobile_money",
          network: "airtel_money",
        },
      },
    });

    assert.equal(createVendorOrderResponse.status, 201);
    const payoutOrderId = createVendorOrderResponse.body._id;
    const payoutOrderReference = createVendorOrderResponse.body.payment.reference;

    const payoutWebhookPayload = {
      type: "payment.completed",
      data: {
        reference: payoutOrderReference,
        status: "completed",
        amount: {
          value: 1500,
          currency: "TZS",
        },
        channel: {
          provider: "airtel_money",
        },
        metadata: {
          order_id: String(payoutOrderId),
        },
      },
    };

    const signedPayoutWebhook = signSnippeWebhookPayload(payoutWebhookPayload);
    const payoutWebhookResponse = await fetch(`${baseUrl}/api/payments/snippe/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Timestamp": signedPayoutWebhook.timestamp,
        "X-Webhook-Signature": signedPayoutWebhook.signature,
      },
      body: signedPayoutWebhook.rawBody,
    });

    assert.equal(payoutWebhookResponse.status, 200);

    const moveToDeliveryResponse = await api(`/api/orders/${payoutOrderId}/status`, {
      method: "PUT",
      token: adminToken,
      body: { status: "out_for_delivery" },
    });
    assert.equal(moveToDeliveryResponse.status, 200);

    const markDeliveredResponse = await api(`/api/orders/${payoutOrderId}/status`, {
      method: "PUT",
      token: adminToken,
      body: { status: "delivered" },
    });
    assert.equal(markDeliveredResponse.status, 200);

    const createdCustomer = await User.findOne({ where: { email: testEmail } });

    const adminPayoutsResponse = await api("/api/admin/vendor-payouts", {
      method: "GET",
      token: adminToken,
    });
    assert.equal(adminPayoutsResponse.status, 200);
    assert.ok(
      adminPayoutsResponse.body.data.readyQueue.some(
        (entry) => Number(entry.orderId) === Number(payoutOrderId) && Number(entry.vendorId) === Number(createdCustomer.id)
      )
    );

    const createPayoutRecordResponse = await api("/api/admin/vendor-payouts", {
      method: "POST",
      token: adminToken,
      body: {
        orderId: payoutOrderId,
        vendorId: createdCustomer.id,
        notes: "Weekly vendor settlement batch.",
      },
    });

    assert.equal(createPayoutRecordResponse.status, 201);
    assert.equal(createPayoutRecordResponse.body.data.status, "pending");
    assert.equal(createPayoutRecordResponse.body.data.amount, 1500);

    const markPayoutPaidResponse = await api(`/api/admin/vendor-payouts/${createPayoutRecordResponse.body.data._id}`, {
      method: "PUT",
      token: adminToken,
      body: {
        status: "paid",
        notes: "Transferred to vendor account.",
      },
    });

    assert.equal(markPayoutPaidResponse.status, 200);
    assert.equal(markPayoutPaidResponse.body.data.status, "paid");
    assert.ok(markPayoutPaidResponse.body.data.paidAt);

    const promoteVendorResponse = await api(`/api/users/${createdCustomer.id}/role`, {
      method: "PATCH",
      token: adminToken,
      body: { role: "vendor" },
    });
    assert.equal(promoteVendorResponse.status, 200);

    const vendorPayoutsResponse = await api("/api/vendor/payouts", {
      method: "GET",
      token,
    });

    assert.equal(vendorPayoutsResponse.status, 200);
    assert.ok(vendorPayoutsResponse.body.data.summary.totalPaid >= 1500);
    const vendorPayout = vendorPayoutsResponse.body.data.items.find(
      (item) => Number(item.order?.id || item.orderId) === Number(payoutOrderId)
    );
    assert.ok(vendorPayout);
    assert.equal(vendorPayout.status, "paid");
    assert.equal(vendorPayout.amount, 1500);
    assert.match(vendorPayout.notes || "", /Transferred to vendor account/i);

    const today = new Date().toISOString().slice(0, 10);
    const filteredAdminPayoutsResponse = await api(`/api/admin/vendor-payouts?status=paid&from=${today}&to=${today}`, {
      method: "GET",
      token: adminToken,
    });
    assert.equal(filteredAdminPayoutsResponse.status, 200);
    assert.ok(filteredAdminPayoutsResponse.body.data.items.length >= 1);
    assert.ok(filteredAdminPayoutsResponse.body.data.items.every((item) => item.status === "paid"));
    assert.equal(filteredAdminPayoutsResponse.body.data.readyQueue.length, 0);

    const adminExportResponse = await fetch(`${baseUrl}/api/admin/vendor-payouts/export.csv?status=paid&from=${today}&to=${today}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.equal(adminExportResponse.status, 200);
    assert.match(adminExportResponse.headers.get("content-type") || "", /text\/csv/i);
    const adminExportText = await adminExportResponse.text();
    assert.match(adminExportText, /source,payout_id,vendor_name/i);
    assert.match(adminExportText, /Transferred to vendor account/i);
    assert.match(adminExportText, new RegExp(`,${payoutOrderId},`));

    const vendorExportResponse = await fetch(`${baseUrl}/api/vendor/payouts/export.csv?status=paid&from=${today}&to=${today}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    assert.equal(vendorExportResponse.status, 200);
    assert.match(vendorExportResponse.headers.get("content-type") || "", /text\/csv/i);
    const vendorExportText = await vendorExportResponse.text();
    assert.match(vendorExportText, /source,payout_id,vendor_name/i);
    assert.match(vendorExportText, /paid/i);
    assert.match(vendorExportText, /Transferred to vendor account/i);

    const revertRoleResponse = await api(`/api/users/${createdCustomer.id}/role`, {
      method: "PATCH",
      token: adminToken,
      body: { role: "customer" },
    });
    assert.equal(revertRoleResponse.status, 200);
  });
});
