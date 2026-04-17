import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const baseUrl = String(process.env.SMOKE_BASE_URL || "http://127.0.0.1:5001")
  .trim()
  .replace(/\/$/, "");
const apiBaseUrl = `${baseUrl}/api`;
const runAdminChecks =
  Boolean(process.env.SMOKE_ADMIN_EMAIL || process.env.ADMIN_EMAIL) &&
  Boolean(process.env.SMOKE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD);
const runPaymentSmoke = process.env.SMOKE_RUN_PAYMENT === "true";
const runWebhookConfirmation = process.env.SMOKE_RUN_WEBHOOK === "true";

const emailSeed = Date.now();
const customerEmail =
  process.env.SMOKE_CUSTOMER_EMAIL || `smoke_${emailSeed}@example.com`;
const customerPassword = process.env.SMOKE_CUSTOMER_PASSWORD || "Password123!";
const customerName = process.env.SMOKE_CUSTOMER_NAME || "Smoke Test Customer";

const adminEmail = process.env.SMOKE_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const logStep = (message) => {
  console.log(`\n[smoke] ${message}`);
};

const parseBody = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
};

const request = async (pathname, { method = "GET", token, body } = {}) => {
  const response = await fetch(`${pathname.startsWith("http") ? pathname : `${apiBaseUrl}${pathname}`}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await parseBody(response);

  return {
    status: response.status,
    ok: response.ok,
    body: payload,
  };
};

const registerCustomer = async () => {
  const response = await request("/auth/register", {
    method: "POST",
    body: {
      name: customerName,
      email: customerEmail,
      password: customerPassword,
    },
  });

  if (response.status === 400 && response.body?.message === "Email exists") {
    return null;
  }

  assert(response.status === 201, `Customer registration failed: ${JSON.stringify(response.body)}`);
  return response.body;
};

const login = async ({ email, password, label }) => {
  const response = await request("/auth/login", {
    method: "POST",
    body: { email, password },
  });

  assert(response.status === 200, `${label} login failed: ${JSON.stringify(response.body)}`);
  assert(response.body?.token, `${label} login did not return a token`);
  return response.body.token;
};

const signWebhookPayload = (payload, secret) => {
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return {
    rawBody,
    timestamp,
    signature,
  };
};

const runCoreChecks = async () => {
  logStep(`Checking health at ${baseUrl}`);
  const healthResponse = await request(baseUrl.replace(/\/api$/, "").replace(/\/$/, "") || baseUrl, {});
  assert(healthResponse.status === 200, `Health check failed: ${JSON.stringify(healthResponse.body)}`);

  logStep("Registering smoke customer");
  await registerCustomer();

  logStep("Logging in smoke customer");
  const customerToken = await login({
    email: customerEmail,
    password: customerPassword,
    label: "Customer",
  });

  logStep("Fetching public products");
  const productsResponse = await request("/products");
  assert(productsResponse.status === 200, `Products fetch failed: ${JSON.stringify(productsResponse.body)}`);

  logStep("Fetching customer orders");
  const ordersResponse = await request("/orders/my", { token: customerToken });
  assert(ordersResponse.status === 200, `Customer orders fetch failed: ${JSON.stringify(ordersResponse.body)}`);

  logStep("Fetching customer notifications");
  const notificationsResponse = await request("/notifications/my", { token: customerToken });
  assert(
    notificationsResponse.status === 200,
    `Customer notifications fetch failed: ${JSON.stringify(notificationsResponse.body)}`
  );

  if (runAdminChecks) {
    logStep("Logging in admin");
    const adminToken = await login({
      email: adminEmail,
      password: adminPassword,
      label: "Admin",
    });

    logStep("Fetching admin dashboard");
    const dashboardResponse = await request("/admin/dashboard", { token: adminToken });
    assert(
      dashboardResponse.status === 200,
      `Admin dashboard fetch failed: ${JSON.stringify(dashboardResponse.body)}`
    );

    logStep("Fetching admin notifications");
    const adminNotificationsResponse = await request("/notifications", { token: adminToken });
    assert(
      adminNotificationsResponse.status === 200,
      `Admin notifications fetch failed: ${JSON.stringify(adminNotificationsResponse.body)}`
    );
  }

  return { customerToken };
};

const runPaymentChecks = async ({ customerToken }) => {
  const productId = Number(process.env.SMOKE_PRODUCT_ID || 0);
  const phone = String(process.env.SMOKE_PHONE || "").trim();
  const network = String(process.env.SMOKE_PAYMENT_NETWORK || "airtel_money").trim();

  assert(productId > 0, "SMOKE_PRODUCT_ID is required for payment smoke");
  assert(phone, "SMOKE_PHONE is required for payment smoke");

  logStep("Creating mobile money order");
  const orderResponse = await request("/orders", {
    method: "POST",
    token: customerToken,
    body: {
      items: [{ productId, quantity: 1 }],
      delivery: {
        type: "home",
        address: process.env.SMOKE_ADDRESS || "Deployment Smoke Test Address",
        contactPhone: phone,
      },
      payment: {
        method: "mobile_money",
        network,
      },
    },
  });

  assert(orderResponse.status === 201, `Order creation failed: ${JSON.stringify(orderResponse.body)}`);
  assert(orderResponse.body?.payment?.reference, "Order response did not include payment reference");

  if (!runWebhookConfirmation) {
    return;
  }

  const webhookSecret = process.env.SNIPPE_WEBHOOK_SECRET;
  assert(webhookSecret, "SNIPPE_WEBHOOK_SECRET is required for webhook smoke");

  logStep("Sending signed payment.completed webhook");
  const payload = {
    type: "payment.completed",
    data: {
      reference: orderResponse.body.payment.reference,
      status: "completed",
      amount: {
        value: Math.round(Number(orderResponse.body.totalAmount || 0)),
        currency: "TZS",
      },
      channel: {
        provider: network,
      },
      metadata: {
        order_id: String(orderResponse.body._id),
      },
    },
  };

  const signed = signWebhookPayload(payload, webhookSecret);
  const webhookResponse = await fetch(`${apiBaseUrl}/payments/snippe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Timestamp": signed.timestamp,
      "X-Webhook-Signature": signed.signature,
    },
    body: signed.rawBody,
  });

  const webhookBody = await parseBody(webhookResponse);
  assert(webhookResponse.status === 200, `Webhook confirmation failed: ${JSON.stringify(webhookBody)}`);
}

const run = async () => {
  console.log(`[smoke] Base URL: ${baseUrl}`);
  console.log(`[smoke] Payment smoke: ${runPaymentSmoke ? "enabled" : "disabled"}`);
  console.log(`[smoke] Webhook confirmation: ${runWebhookConfirmation ? "enabled" : "disabled"}`);

  const core = await runCoreChecks();

  if (runPaymentSmoke) {
    await runPaymentChecks(core);
  }

  console.log("\n[smoke] Completed successfully");
};

run().catch((error) => {
  console.error(`\n[smoke] Failed: ${error.message}`);
  process.exit(1);
});
