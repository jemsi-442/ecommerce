import asyncHandler from "../middleware/asyncHandler.js";
import { AuditLog, Order, OrderItem, Product, Rider, User } from "../models/index.js";
import ProductService from "../services/ProductService.js";
import { sendResponse } from "../utils/apiResponse.js";
import { createNotificationRecord } from "../utils/createNotificationRecord.js";
import { serializeOrder, serializeUser } from "../utils/serializers.js";
import { uploadProductImage } from "../middleware/uploadMiddleware.js";

const STORE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const normalizeNullableText = (value = "") => {
  const normalized = String(value).trim().replace(/\s+/g, " ");
  return normalized || null;
};

const normalizeStoreSlug = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const buildStoreSlug = (storeName, explicitSlug) => normalizeStoreSlug(explicitSlug || storeName || "");

const ensureUniqueStoreSlug = async (candidate, currentUserId) => {
  if (!candidate) {
    return null;
  }

  let nextSlug = candidate;
  let suffix = 1;

  while (true) {
    const existingUser = await User.findOne({ where: { storeSlug: nextSlug } });
    if (!existingUser || Number(existingUser.id) === Number(currentUserId)) {
      return nextSlug;
    }

    suffix += 1;
    nextSlug = `${candidate}-${suffix}`;
  }
};

const vendorOrderIncludes = [
  { model: User, as: "user", attributes: ["id", "name", "email"] },
  { model: Rider, as: "rider", attributes: ["id", "name", "phone"], required: false },
  {
    model: OrderItem,
    as: "items",
    required: true,
    include: [
      {
        model: Product,
        as: "product",
        attributes: ["id", "name", "image", "createdBy", "sku"],
        required: true,
      },
    ],
  },
];

const getPayoutStatus = (status) => {
  switch (status) {
    case "pending":
      return "awaiting_payment";
    case "paid":
    case "out_for_delivery":
      return "processing";
    case "delivered":
      return "ready_for_payout";
    case "cancelled":
    case "refunded":
      return "on_hold";
    default:
      return "processing";
  }
};

const DELIVERY_ISSUE_STATUSES = new Set(["open", "investigating", "resolved"]);

const buildVendorItems = (items, payoutStatus) =>
  items.map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.price || 0);
    const lineTotal = Number((quantity * unitPrice).toFixed(2));
    const estimatedPayout = payoutStatus === "on_hold" ? 0 : lineTotal;

    return {
      _id: item.id,
      product: item.product?.id || item.productId,
      sku: item.product?.sku || null,
      name: item.product?.name || item.name || null,
      image: item.product?.image || null,
      qty: quantity,
      price: unitPrice,
      lineTotal,
      estimatedPayout,
      payoutStatus,
    };
  });

const summarizeVendorOrder = (order) => {
  const serialized = serializeOrder(order);
  const payoutStatus = getPayoutStatus(serialized.status);
  const vendorItems = buildVendorItems(order.items || [], payoutStatus);
  const subtotal = vendorItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  const estimatedPayout = vendorItems.reduce((sum, item) => sum + Number(item.estimatedPayout || 0), 0);

  return {
    ...serialized,
    items: vendorItems,
    vendorSummary: {
      subtotal: Number(subtotal.toFixed(2)),
      estimatedPayout: Number(estimatedPayout.toFixed(2)),
      itemCount: vendorItems.reduce((sum, item) => sum + Number(item.qty || 0), 0),
      productCount: vendorItems.length,
      payoutStatus,
      orderStatus: serialized.status,
      paymentStatus: serialized.payment?.status || null,
      paymentReference: serialized.payment?.reference || null,
      paymentProvider: serialized.payment?.provider || null,
      customerPaid: Boolean(serialized.payment?.isPaid),
    },
  };
};

export const getVendorProfile = asyncHandler(async (req, res) => {
  const vendor = await User.findByPk(req.user._id);
  return sendResponse(res, 200, "Vendor profile fetched", serializeUser(vendor));
});

export const updateVendorProfile = asyncHandler(async (req, res) => {
  const vendor = await User.findByPk(req.user._id);

  const storeName = normalizeNullableText(req.body?.storeName);
  const businessPhone = normalizeNullableText(req.body?.businessPhone);
  const businessDescription = normalizeNullableText(req.body?.businessDescription);
  const rawSlug = normalizeStoreSlug(req.body?.storeSlug || "");

  if (!storeName || storeName.length < 2) {
    return sendResponse(res, 400, "Store name must be at least 2 characters");
  }

  if (businessPhone && businessPhone.length < 6) {
    return sendResponse(res, 400, "Business phone must be at least 6 characters");
  }

  if (businessDescription && businessDescription.length > 600) {
    return sendResponse(res, 400, "Business description must be 600 characters or less");
  }

  const desiredSlug = buildStoreSlug(storeName, rawSlug);

  if (!desiredSlug || desiredSlug.length < 3 || !STORE_SLUG_REGEX.test(desiredSlug)) {
    return sendResponse(res, 400, "Store slug must be at least 3 characters and use letters, numbers, or hyphens");
  }

  vendor.storeName = storeName;
  vendor.storeSlug = await ensureUniqueStoreSlug(desiredSlug, vendor.id);
  vendor.businessPhone = businessPhone;
  vendor.businessDescription = businessDescription;
  await vendor.save();

  return sendResponse(res, 200, "Vendor profile updated", serializeUser(vendor));
});

export const getVendorProducts = asyncHandler(async (req, res) => {
  const data = await ProductService.listProducts({
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
    includeUnapproved: true,
    ownerId: req.user._id,
  });

  return sendResponse(res, 200, "Vendor products fetched", data);
});

export const createVendorProduct = asyncHandler(async (req, res) => {
  const payload = { ...req.body };

  if (req.file?.buffer) {
    const image = await uploadProductImage(req.file.buffer, req.file.originalname);
    payload.images = [...(payload.images || []), image];
  }

  const product = await ProductService.createProduct(payload, req.user._id, {
    actorRole: "vendor",
  });

  return sendResponse(res, 201, "Product submitted for review", product);
});

export const updateVendorProduct = asyncHandler(async (req, res) => {
  const payload = { ...req.body };

  if (req.file?.buffer) {
    const image = await uploadProductImage(req.file.buffer, req.file.originalname);
    payload.images = [...(payload.images || []), image];
  }

  const product = await ProductService.updateProduct(req.params.id, payload, {
    actorId: req.user._id,
    actorRole: "vendor",
  });

  return sendResponse(res, 200, "Product updated and sent for review", product);
});

export const deleteVendorProduct = asyncHandler(async (req, res) => {
  await ProductService.deleteProduct(req.params.id, {
    actorId: req.user._id,
    actorRole: "vendor",
  });

  return sendResponse(res, 200, "Product deleted", null);
});

export const getVendorOrders = asyncHandler(async (req, res) => {
  const orders = await Order.findAll({
    include: vendorOrderIncludes,
    order: [["created_at", "DESC"]],
  });

  const vendorOrders = orders
    .map((order) => {
      const json = order.toJSON();
      const items = Array.isArray(json.items)
        ? json.items.filter((item) => Number(item.product?.createdBy) === Number(req.user._id))
        : [];

      if (!items.length) {
        return null;
      }

      return summarizeVendorOrder({ ...json, items });
    })
    .filter(Boolean);

  return sendResponse(res, 200, "Vendor orders fetched", {
    items: vendorOrders,
    summary: {
      totalOrders: vendorOrders.length,
      totalRevenue: Number(
        vendorOrders.reduce((sum, order) => sum + Number(order.vendorSummary?.subtotal || 0), 0).toFixed(2)
      ),
      projectedPayout: Number(
        vendorOrders.reduce((sum, order) => sum + Number(order.vendorSummary?.estimatedPayout || 0), 0).toFixed(2)
      ),
      pendingOrders: vendorOrders.filter((order) => order.status === "pending").length,
      processingOrders: vendorOrders.filter((order) => order.vendorSummary?.payoutStatus === "processing").length,
      readyForPayoutOrders: vendorOrders.filter((order) => order.vendorSummary?.payoutStatus === "ready_for_payout").length,
      onHoldOrders: vendorOrders.filter((order) => order.vendorSummary?.payoutStatus === "on_hold").length,
      awaitingPayment: vendorOrders.filter((order) => order.vendorSummary?.payoutStatus === "awaiting_payment").length,
      readyForPayoutTotal: Number(
        vendorOrders
          .filter((order) => order.vendorSummary?.payoutStatus === "ready_for_payout")
          .reduce((sum, order) => sum + Number(order.vendorSummary?.estimatedPayout || 0), 0)
          .toFixed(2)
      ),
    },
  });
});

export const updateVendorDeliveryIssueStatus = asyncHandler(async (req, res) => {
  const order = await Order.findByPk(req.params.id, {
    include: vendorOrderIncludes,
  });

  if (!order) {
    return sendResponse(res, 404, "Order not found");
  }

  const json = order.toJSON();
  const vendorItems = Array.isArray(json.items)
    ? json.items.filter((item) => Number(item.product?.createdBy) === Number(req.user._id))
    : [];

  if (!vendorItems.length) {
    return sendResponse(res, 403, "This order does not belong to your store");
  }

  if (!order.deliveryIssueReason) {
    return sendResponse(res, 400, "This order does not have a reported delivery issue");
  }

  const nextStatus = String(req.body?.status || "").trim().toLowerCase();
  const resolutionNote = normalizeNullableText(req.body?.resolutionNote || "");

  if (!DELIVERY_ISSUE_STATUSES.has(nextStatus)) {
    return sendResponse(res, 400, "Choose a valid issue status");
  }

  order.deliveryIssueStatus = nextStatus;
  order.deliveryIssueResolutionNote = resolutionNote;
  order.deliveryIssueResolvedAt = nextStatus === "resolved" ? new Date() : null;
  await order.save();

  await AuditLog.create({
    orderId: order.id,
    userId: req.user._id,
    riderId: order.riderId || null,
    userName: req.user?.name || null,
    riderName: order.rider?.name || null,
    type: "delivery",
    action: "vendor_delivery_issue_status_updated",
    message: `Vendor updated delivery issue for order ${order.id} to ${nextStatus}`,
    meta: {
      status: nextStatus,
      resolutionNote,
      vendorId: req.user._id,
    },
  });

  await createNotificationRecord({
    orderId: order.id,
    type: "customer_delivery_issue_update",
    audience: "customer",
    message:
      nextStatus === "resolved"
        ? `Your delivery issue for order #${order.id} has been resolved by the store team.`
        : `Your delivery issue for order #${order.id} is now ${nextStatus}.`,
    phone: order.deliveryContactPhone || order.user?.phone || null,
    customerName: order.user?.name || null,
    riderName: order.rider?.name || null,
    status: "logged",
    userId: order.userId,
  });

  const refreshed = await Order.findByPk(order.id, { include: vendorOrderIncludes });
  const refreshedJson = refreshed.toJSON();
  const refreshedItems = Array.isArray(refreshedJson.items)
    ? refreshedJson.items.filter((item) => Number(item.product?.createdBy) === Number(req.user._id))
    : [];

  return sendResponse(res, 200, "Delivery issue updated", summarizeVendorOrder({ ...refreshedJson, items: refreshedItems }));
});
