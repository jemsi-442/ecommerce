import asyncHandler from "../middleware/asyncHandler.js";
import { Op } from "sequelize";
import { AuditLog, Order, OrderItem, Product, User, VendorPayout } from "../models/index.js";
import { sendResponse } from "../utils/apiResponse.js";

const payoutOrderIncludes = [
  { model: User, as: "user", attributes: ["id", "name", "email"] },
  {
    model: OrderItem,
    as: "items",
    required: true,
    include: [
      {
        model: Product,
        as: "product",
        attributes: ["id", "name", "image", "sku", "createdBy"],
        required: true,
      },
    ],
  },
];

const payoutIncludes = [
  { model: User, as: "vendor", attributes: ["id", "name", "email", "storeName", "storeSlug"] },
  { model: User, as: "creator", attributes: ["id", "name"], required: false },
  { model: User, as: "processor", attributes: ["id", "name"], required: false },
  {
    model: Order,
    as: "order",
    attributes: ["id", "status", "paymentStatus", "paymentReference", "deliveredAt"],
    include: [{ model: User, as: "user", attributes: ["id", "name", "email"], required: false }],
  },
];

const formatPayout = (payout) => ({
  ...payout.toJSON(),
  _id: payout.id,
  amount: Number(payout.amount || 0),
});

const getVendorLineItems = (order, vendorId) => {
  const items = Array.isArray(order.items) ? order.items : [];
  return items
    .filter((item) => Number(item.product?.createdBy) === Number(vendorId))
    .map((item) => ({
      _id: item.id,
      product: item.product?.id || item.productId,
      name: item.product?.name || null,
      sku: item.product?.sku || null,
      qty: Number(item.quantity || 0),
      price: Number(item.price || 0),
      image: item.product?.image || null,
      lineTotal: Number((Number(item.quantity || 0) * Number(item.price || 0)).toFixed(2)),
    }));
};

const buildDerivedPayout = async (order, vendorId) => {
  const vendor = await User.findByPk(vendorId, {
    attributes: ["id", "name", "email", "storeName", "storeSlug"],
  });
  if (!vendor) return null;

  const items = getVendorLineItems(order, vendorId);
  if (!items.length) return null;

  const amount = Number(items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0).toFixed(2));

  return {
    _id: `derived-${order.id}-${vendorId}`,
    vendorId,
    orderId: order.id,
    amount,
    status: order.status === "delivered" ? "pending" : "on_hold",
    notes: null,
    paidAt: null,
    createdAt: order.deliveredAt || order.createdAt || order.created_at || null,
    vendor: {
      _id: vendor.id,
      id: vendor.id,
      name: vendor.name,
      email: vendor.email,
      storeName: vendor.storeName || null,
      storeSlug: vendor.storeSlug || null,
    },
    order: {
      _id: order.id,
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus || null,
      paymentReference: order.paymentReference || null,
      deliveredAt: order.deliveredAt || null,
      createdAt: order.createdAt || order.created_at || null,
      user: order.user
        ? {
            _id: order.user.id,
            id: order.user.id,
            name: order.user.name,
            email: order.user.email,
          }
        : null,
    },
    items,
    derived: true,
  };
};

const getExistingPayoutMap = async () => {
  const payouts = await VendorPayout.findAll({ attributes: ["vendorId", "orderId"] });
  return new Set(payouts.map((entry) => `${entry.orderId}:${entry.vendorId}`));
};

const getEligibleDerivedPayouts = async ({ vendorId = null } = {}) => {
  const where = vendorId
    ? { status: "delivered" }
    : {
        status: {
          [Op.in]: ["delivered", "cancelled", "refunded"],
        },
      };
  const orders = await Order.findAll({
    where,
    include: payoutOrderIncludes,
    order: [["created_at", "DESC"]],
  });

  const existingMap = await getExistingPayoutMap();
  const derived = [];

  for (const order of orders) {
    const rawOrder = order.toJSON();
    const vendorIds = [...new Set((rawOrder.items || []).map((item) => Number(item.product?.createdBy)).filter(Boolean))];

    for (const currentVendorId of vendorIds) {
      if (vendorId && Number(currentVendorId) !== Number(vendorId)) continue;
      const key = `${rawOrder.id}:${currentVendorId}`;
      if (existingMap.has(key)) continue;
      const payout = await buildDerivedPayout(rawOrder, currentVendorId);
      if (payout) derived.push(payout);
    }
  }

  return derived;
};

const ensurePayoutCandidate = async (orderId, vendorId) => {
  const order = await Order.findByPk(orderId, { include: payoutOrderIncludes });
  if (!order) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  if (!["delivered", "cancelled", "refunded"].includes(order.status)) {
    const error = new Error("This order is not ready for settlement yet");
    error.statusCode = 400;
    throw error;
  }

  const existing = await VendorPayout.findOne({ where: { orderId, vendorId } });
  if (existing) {
    const error = new Error("A payout record already exists for this vendor and order");
    error.statusCode = 409;
    throw error;
  }

  const payout = await buildDerivedPayout(order.toJSON(), vendorId);
  if (!payout) {
    const error = new Error("No vendor items were found for this order");
    error.statusCode = 400;
    throw error;
  }

  return payout;
};

const buildPayoutSummary = (payouts, readyQueue) => ({
  totalRecords: payouts.length,
  pendingRecords: payouts.filter((item) => item.status === "pending").length,
  paidRecords: payouts.filter((item) => item.status === "paid").length,
  onHoldRecords: payouts.filter((item) => item.status === "on_hold").length,
  totalPaid: Number(
    payouts.filter((item) => item.status === "paid").reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)
  ),
  pendingAmount: Number(
    payouts.filter((item) => item.status === "pending").reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)
  ),
  readyQueueAmount: Number(
    readyQueue.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)
  ),
});

const PAYOUT_STATUSES = ["pending", "paid", "on_hold", "all"];

const normalizePayoutFilters = (query = {}) => {
  const status = String(query.status || "all").trim().toLowerCase();
  const normalizedStatus = PAYOUT_STATUSES.includes(status) ? status : "all";

  const from = query.from ? new Date(String(query.from) + "T00:00:00.000Z") : null;
  const to = query.to ? new Date(String(query.to) + "T23:59:59.999Z") : null;

  return {
    status: normalizedStatus,
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    to: to && !Number.isNaN(to.getTime()) ? to : null,
  };
};

const buildRecordWhere = (filters = {}, extraWhere = {}) => {
  const where = { ...extraWhere };

  if (filters.status && filters.status !== "all") {
    where.status = filters.status;
  }

  if (filters.from || filters.to) {
    where.created_at = {};
    if (filters.from) where.created_at[Op.gte] = filters.from;
    if (filters.to) where.created_at[Op.lte] = filters.to;
  }

  return where;
};

const matchesDateRange = (value, filters = {}) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return !filters.from && !filters.to;
  if (filters.from && date < filters.from) return false;
  if (filters.to && date > filters.to) return false;
  return true;
};

const filterReadyQueue = (readyQueue, filters = {}) =>
  readyQueue.filter((entry) => {
    if (filters.status && filters.status !== "all" && entry.status !== filters.status) {
      return false;
    }

    return matchesDateRange(entry.createdAt || entry.order?.deliveredAt || null, filters);
  });

const payoutExportHeaders = [
  "source",
  "payout_id",
  "vendor_name",
  "store_slug",
  "order_id",
  "order_status",
  "payment_status",
  "payment_reference",
  "customer_name",
  "customer_email",
  "amount",
  "payout_status",
  "notes",
  "created_at",
  "paid_at",
];

const escapeCsvValue = (value) => {
  const normalized = value === null || value === undefined ? "" : String(value);
  if (!/[",\n]/.test(normalized)) return normalized;
  return "\"" + normalized.replace(/\"/g, "\"\"") + "\"";
};

const buildPayoutExportRows = (payouts, readyQueue) => {
  const entries = [
    ...payouts.map((entry) => ({ ...entry, source: "record" })),
    ...readyQueue.map((entry) => ({ ...entry, source: "ready_queue" })),
  ];

  return entries.map((entry) => {
    const vendor = entry.vendor || {};
    const order = entry.order || {};
    const customer = order.user || {};
    return [
      entry.source || "record",
      entry.source === "record" ? entry._id || entry.id || "" : "",
      vendor.storeName || vendor.name || "",
      vendor.storeSlug || "",
      entry.orderId || order.id || "",
      order.status || "",
      order.paymentStatus || "",
      order.paymentReference || "",
      customer.name || "",
      customer.email || "",
      Number(entry.amount || 0).toFixed(2),
      entry.status || "",
      entry.notes || "",
      entry.createdAt || order.deliveredAt || "",
      entry.paidAt || "",
    ].map(escapeCsvValue).join(",");
  });
};

const sendPayoutExport = (res, filename, payouts, readyQueue) => {
  const rows = [payoutExportHeaders.join(","), ...buildPayoutExportRows(payouts, readyQueue)];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
  res.status(200).send("\uFEFF" + rows.join("\n"));
};

export const getAdminVendorPayouts = asyncHandler(async (req, res) => {
  const filters = normalizePayoutFilters(req.query);
  const [records, readyQueue] = await Promise.all([
    VendorPayout.findAll({
      where: buildRecordWhere(filters),
      include: payoutIncludes,
      order: [["created_at", "DESC"]],
    }),
    getEligibleDerivedPayouts(),
  ]);

  const payouts = records.map(formatPayout);
  const filteredReadyQueue = filterReadyQueue(readyQueue, filters);

  return sendResponse(res, 200, "Vendor payouts fetched", {
    items: payouts,
    readyQueue: filteredReadyQueue,
    summary: buildPayoutSummary(payouts, filteredReadyQueue),
    filters: {
      status: filters.status,
      from: req.query.from || "",
      to: req.query.to || "",
    },
  });
});

export const exportAdminVendorPayoutsCsv = asyncHandler(async (req, res) => {
  const filters = normalizePayoutFilters(req.query);
  const [records, readyQueue] = await Promise.all([
    VendorPayout.findAll({
      where: buildRecordWhere(filters),
      include: payoutIncludes,
      order: [["created_at", "DESC"]],
    }),
    getEligibleDerivedPayouts(),
  ]);

  sendPayoutExport(res, "vendor-settlements.csv", records.map(formatPayout), filterReadyQueue(readyQueue, filters));
});

export const createVendorPayoutRecord = asyncHandler(async (req, res) => {
  const orderId = Number(req.body?.orderId);
  const vendorId = Number(req.body?.vendorId);
  const notes = String(req.body?.notes || "").trim() || null;

  const candidate = await ensurePayoutCandidate(orderId, vendorId);
  const payout = await VendorPayout.create({
    vendorId,
    orderId,
    amount: candidate.amount,
    status: candidate.status === "on_hold" ? "on_hold" : "pending",
    notes,
    createdBy: req.user._id,
    processedBy: null,
    paidAt: null,
  });

  await AuditLog.create({
    orderId,
    userId: req.user._id,
    type: "payment",
    action: "vendor_payout_created",
    message: `Vendor payout record created for order ${orderId}`,
    meta: {
      vendorId,
      amount: candidate.amount,
      payoutStatus: payout.status,
      notes,
    },
  });

  const fullPayout = await VendorPayout.findByPk(payout.id, { include: payoutIncludes });
  return sendResponse(res, 201, "Vendor payout recorded", formatPayout(fullPayout));
});

export const updateVendorPayoutRecord = asyncHandler(async (req, res) => {
  const payout = await VendorPayout.findByPk(req.params.id, { include: payoutIncludes });
  if (!payout) {
    return res.status(404).json({ message: "Payout record not found" });
  }

  const status = String(req.body?.status || payout.status).trim();
  const notes = String(req.body?.notes || payout.notes || "").trim() || null;
  if (!["pending", "paid", "on_hold"].includes(status)) {
    return res.status(400).json({ message: "Invalid payout status" });
  }

  payout.status = status;
  payout.notes = notes;
  payout.processedBy = req.user._id;
  payout.paidAt = status === "paid" ? new Date() : null;
  await payout.save();

  await AuditLog.create({
    orderId: payout.orderId,
    userId: req.user._id,
    type: "payment",
    action: status === "paid" ? "vendor_payout_paid" : "vendor_payout_updated",
    message: `Vendor payout ${payout.id} updated to ${status}`,
    meta: {
      payoutId: payout.id,
      vendorId: payout.vendorId,
      status,
      notes,
      amount: Number(payout.amount || 0),
    },
  });

  const fullPayout = await VendorPayout.findByPk(payout.id, { include: payoutIncludes });
  return sendResponse(res, 200, "Vendor payout updated", formatPayout(fullPayout));
});

export const getVendorPayouts = asyncHandler(async (req, res) => {
  const filters = normalizePayoutFilters(req.query);
  const [records, pendingQueue] = await Promise.all([
    VendorPayout.findAll({
      where: buildRecordWhere(filters, { vendorId: req.user._id }),
      include: payoutIncludes,
      order: [["created_at", "DESC"]],
    }),
    getEligibleDerivedPayouts({ vendorId: req.user._id }),
  ]);

  const payouts = records.map(formatPayout);
  const filteredReadyQueue = filterReadyQueue(pendingQueue, filters);
  return sendResponse(res, 200, "Vendor payout history fetched", {
    items: payouts,
    readyQueue: filteredReadyQueue,
    summary: buildPayoutSummary(payouts, filteredReadyQueue),
    filters: {
      status: filters.status,
      from: req.query.from || "",
      to: req.query.to || "",
    },
  });
});

export const exportVendorPayoutsCsv = asyncHandler(async (req, res) => {
  const filters = normalizePayoutFilters(req.query);
  const [records, pendingQueue] = await Promise.all([
    VendorPayout.findAll({
      where: buildRecordWhere(filters, { vendorId: req.user._id }),
      include: payoutIncludes,
      order: [["created_at", "DESC"]],
    }),
    getEligibleDerivedPayouts({ vendorId: req.user._id }),
  ]);

  sendPayoutExport(res, "vendor-payout-history.csv", records.map(formatPayout), filterReadyQueue(pendingQueue, filters));
});
