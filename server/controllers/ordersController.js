import { AuditLog, Order, OrderItem, Product, Rider, User } from "../models/index.js";
import { assignRider } from "../utils/assignRider.js";
import { canTransition } from "../utils/orderStatusFlow.js";
import { serializeOrder } from "../utils/serializers.js";
import { validatePhoneForSelectedNetwork } from "../utils/mobileMoneyNetworks.js";
import {
  notifyOrderAwaitingPayment,
  notifyOrderPaymentCompleted,
  notifyOrderPaymentIssue,
  notifyOrderStatusChanged,
} from "../utils/orderNotifications.js";
import {
  createSnippeMobilePayment,
  getSnippePaymentStatus,
  getSnippeWebhookUrl,
  triggerSnippePaymentPush,
} from "../utils/snippe.js";

const orderIncludes = [
  { model: User, as: "user", attributes: ["id", "name", "email"] },
  { model: Rider, as: "rider", attributes: ["id", "name", "phone"] },
  {
    model: OrderItem,
    as: "items",
    include: [{ model: Product, as: "product", attributes: ["id", "name"] }],
  },
];

const normalizeQuantity = (value) => {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
};

const normalizeOrderItemRequests = (items = []) => {
  const requestedItems = Array.isArray(items) ? items : [];
  const aggregatedRequests = new Map();

  for (const item of requestedItems) {
    const productId = Number(item?.product ?? item?.productId);
    const quantity = normalizeQuantity(item?.qty ?? item?.quantity ?? 1);

    if (!Number.isInteger(productId) || productId <= 0 || !quantity) {
      throw new Error("Each order item must include a valid product and quantity");
    }

    aggregatedRequests.set(productId, (aggregatedRequests.get(productId) || 0) + quantity);
  }

  return Array.from(aggregatedRequests.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
};

const buildReservedOrderItemsFromCatalog = async (items = [], transaction) => {
  const normalizedRequests = normalizeOrderItemRequests(items);

  const productIds = [...new Set(normalizedRequests.map((item) => item.productId))];
  const products = await Product.findAll({
    where: {
      id: productIds,
      status: "approved",
    },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  const productMap = new Map(products.map((product) => [Number(product.id), product]));

  if (productMap.size !== productIds.length) {
    throw new Error("One or more selected products are unavailable");
  }

  const lineItems = normalizedRequests.map((item) => {
    const product = productMap.get(item.productId);
    const availableStock = Number(product.stock || 0);

    if (availableStock < item.quantity) {
      throw new Error(`${product.name} does not have enough stock`);
    }

    return {
      productId: item.productId,
      quantity: item.quantity,
      price: Number(product.price),
    };
  });

  for (const item of lineItems) {
    await Product.decrement("stock", {
      by: item.quantity,
      where: { id: item.productId },
      transaction,
    });
  }

  const totalAmount = lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return {
    lineItems,
    totalAmount: Number(totalAmount.toFixed(2)),
  };
};

const restoreInventoryForLineItems = async (lineItems = [], transaction) => {
  for (const item of lineItems) {
    await Product.increment("stock", {
      by: Number(item.quantity || 0),
      where: { id: item.productId },
      transaction,
    });
  }
};

const restoreInventoryForOrder = async (orderId, transaction) => {
  const items = await OrderItem.findAll({
    where: { orderId },
    transaction,
  });

  if (!items.length) {
    return;
  }

  const aggregatedItems = new Map();

  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity || 0);
    aggregatedItems.set(productId, (aggregatedItems.get(productId) || 0) + quantity);
  }

  await restoreInventoryForLineItems(
    Array.from(aggregatedItems.entries()).map(([productId, quantity]) => ({
      productId,
      quantity,
    })),
    transaction
  );
};

const normalizePaymentMethod = (method = "") => {
  if (String(method).trim().toLowerCase() === "mobile_money") {
    return "mobile_money";
  }

  return null;
};

const normalizeRequestedMobileNetwork = (value = "") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  switch (normalized) {
    case "mpesa":
    case "m_pesa":
    case "vodacom":
      return "mpesa";
    case "airtel":
    case "airtelmoney":
    case "airtel_money":
      return "airtel_money";
    case "mixx":
    case "yas":
    case "mixx_by_yas":
      return "mixx_by_yas";
    case "halotel":
    case "halopesa":
    case "halo_pesa":
      return "halopesa";
    default:
      return null;
  }
};

const markOrderPaidInternally = async (order) => {
  if (order.isPaid) {
    return order;
  }

  if (!canTransition(order.status, "paid")) {
    throw new Error(`Cannot move from ${order.status} → paid`);
  }

  order.status = "paid";
  order.isPaid = true;
  order.paidAt = new Date();
  order.paymentStatus = "completed";
  order.paymentFailureReason = null;
  order.paymentFailedAt = null;

  if (order.deliveryType === "home") {
    const riderId = await assignRider();

    if (riderId) {
      order.riderId = riderId;
      order.assignedAt = new Date();
      order.status = "out_for_delivery";
    }
  }

  await order.save();
  return order;
};

const buildSnippePaymentIntentPayload = (
  payment = {},
  {
    fallbackProvider = null,
    defaultMessage = "Check your phone and complete the mobile money prompt.",
  } = {}
) => ({
  provider: payment.channel?.provider || fallbackProvider || "snippe",
  apiVersion: payment.api_version || null,
  status: payment.status || "pending",
  reference: payment.reference || null,
  expiresAt: payment.expires_at || null,
  amount: payment.amount?.value ?? null,
  currency: payment.amount?.currency || "TZS",
  message: defaultMessage,
});

const buildSnippeRetryIdempotencyKey = (order) =>
  `o${order.id}r${Date.now().toString(36)}`.slice(0, 30);

const shouldCreateReplacementPayment = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("create a new payment") ||
    message.includes("new payment") ||
    message.includes("not support push") ||
    message.includes("push retrigger")
  );
};

const createMobileMoneyPaymentIntent = async ({
  req,
  order,
  requestedNetwork,
  idempotencyKey = `order-${order.id}-mobile`,
}) => {
  const payment = await createSnippeMobilePayment({
    amount: order.totalAmount,
    phoneNumber: order.deliveryContactPhone,
    customerName: req.user?.name,
    customerEmail: req.user?.email,
    webhookUrl: getSnippeWebhookUrl(req),
    metadata: {
      order_id: String(order.id),
      user_id: String(req.user?._id || ""),
      requested_network: requestedNetwork || undefined,
    },
    idempotencyKey,
  });

  return buildSnippePaymentIntentPayload(payment, {
    fallbackProvider: requestedNetwork,
  });
};

const createReplacementMobileMoneyPayment = async ({ req, order, requestedNetwork }) => {
  const paymentIntent = await createMobileMoneyPaymentIntent({
    req,
    order,
    requestedNetwork: normalizeRequestedMobileNetwork(
      requestedNetwork || order.paymentProvider || ""
    ),
    idempotencyKey: buildSnippeRetryIdempotencyKey(order),
  });
  order.paymentProvider = paymentIntent.provider;
  order.paymentReference = paymentIntent.reference;
  order.paymentStatus = paymentIntent.status;
  order.paymentExpiresAt = paymentIntent.expiresAt;
  order.paymentFailureReason = null;
  order.paymentFailedAt = null;
  await order.save();
  return paymentIntent;
};

const updateOrderFromSnippePayment = async (order, paymentData) => {
  if (!order || !paymentData) {
    return order;
  }

  order.paymentProvider = paymentData.channel?.provider || order.paymentProvider || "snippe";
  order.paymentReference = paymentData.reference || order.paymentReference || null;
  order.paymentExpiresAt = paymentData.expires_at || order.paymentExpiresAt;

  if (paymentData.status === "completed") {
    await markOrderPaidInternally(order);
    return order;
  }

  if (order.isPaid) {
    order.paymentStatus = "completed";
    order.paymentFailureReason = null;
    order.paymentFailedAt = null;
    await order.save();
    return order;
  }

  if (!order.isPaid) {
    order.paymentStatus = paymentData.status || order.paymentStatus;
  }

  if (paymentData.status === "failed") {
    order.paymentFailedAt = new Date();
    order.paymentFailureReason =
      paymentData.failure_reason || "Mobile money payment failed";
  } else if (paymentData.status === "expired") {
    order.paymentFailureReason = "Mobile money payment expired before confirmation";
  } else if (paymentData.status === "voided") {
    order.paymentFailureReason = "Mobile money payment was voided";
  }

  await order.save();
  return order;
};

const loadOrderForPaymentAction = async (req, res) => {
  const order = await Order.findByPk(req.params.id);

  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return null;
  }

  const isAdmin = req.user?.role === "admin";
  const isOwner = String(order.userId) === String(req.user?._id);

  if (!isAdmin && !isOwner) {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }

  if (order.paymentMethod !== "mobile_money" || !order.paymentReference) {
    res.status(400).json({ message: "This order does not have a mobile money payment reference" });
    return null;
  }

  return order;
};

const logPaymentAudit = async ({
  order = null,
  orderId = null,
  action,
  message,
  meta = {},
}) => {
  try {
    await AuditLog.create({
      type: "payment",
      action,
      message,
      orderId: order?.id || orderId || null,
      userId: order?.userId || null,
      meta,
    });
  } catch (error) {
    console.error("PAYMENT AUDIT LOG ERROR:", error);
  }
};

export const createOrder = async (req, res) => {
  try {
    const { items, delivery, payment } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Order items required" });
    }

    if (!delivery?.type || !delivery?.contactPhone) {
      return res.status(400).json({ message: "Delivery type and contactPhone are required" });
    }

    const paymentMethod = normalizePaymentMethod(payment?.method);
    const requestedNetwork = normalizeRequestedMobileNetwork(payment?.network);
    let paymentIntent = null;
    let lineItems = [];
    let totalAmount = 0;
    let createdOrderId = null;

    if (paymentMethod !== "mobile_money") {
      return res.status(400).json({
        message: "Only mobile money payments are supported right now",
      });
    }

    if (!requestedNetwork) {
      return res.status(400).json({
        message: "Choose a supported mobile money network before placing the order",
      });
    }

    const phoneValidation = validatePhoneForSelectedNetwork(
      delivery.contactPhone,
      requestedNetwork
    );

    if (!phoneValidation.valid) {
      return res.status(400).json({ message: phoneValidation.message });
    }

    const order = await Order.sequelize.transaction(async (transaction) => {
      const reservation = await buildReservedOrderItemsFromCatalog(items, transaction);
      lineItems = reservation.lineItems;
      totalAmount = reservation.totalAmount;

      const createdOrder = await Order.create(
        {
          userId: req.user._id,
          totalAmount,
          deliveryType: delivery.type,
          deliveryAddress: delivery.address || null,
          deliveryContactPhone: delivery.contactPhone,
          paymentMethod,
          inventoryReserved: true,
        },
        { transaction }
      );
      createdOrderId = createdOrder.id;

      await OrderItem.bulkCreate(
        lineItems.map((item) => ({
          orderId: createdOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        { transaction }
      );

      return createdOrder;
    });

    try {
      paymentIntent = await createMobileMoneyPaymentIntent({
        req,
        order,
        requestedNetwork,
      });

      order.paymentProvider = paymentIntent.provider;
      order.paymentReference = paymentIntent.reference;
      order.paymentStatus = paymentIntent.status;
      order.paymentExpiresAt = paymentIntent.expiresAt;
      await order.save();
    } catch (paymentError) {
      if (createdOrderId) {
        try {
          await Order.sequelize.transaction(async (transaction) => {
            await restoreInventoryForLineItems(lineItems, transaction);
            await OrderItem.destroy({ where: { orderId: createdOrderId }, transaction });
            await Order.destroy({ where: { id: createdOrderId }, transaction });
          });
        } catch (rollbackError) {
          console.error("ORDER PAYMENT COMPENSATION ERROR:", rollbackError);
        }
      }

      throw paymentError;
    }

    const fullOrder = await Order.findByPk(order.id, { include: orderIncludes });
    await notifyOrderAwaitingPayment(fullOrder);
    res.status(201).json({
      ...serializeOrder(fullOrder),
      paymentIntent,
    });
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    if (
      err.message === "Each order item must include a valid product and quantity" ||
      err.message === "One or more selected products are unavailable" ||
      err.message?.includes("does not have enough stock") ||
      err.message?.includes("Snippe mobile payments require at least") ||
      err.message?.includes("Snippe could not start the mobile money prompt") ||
      err.message === "Only mobile money payments are supported right now" ||
      err.message === "Choose a supported mobile money network before placing the order"
    ) {
      return res.status(400).json({ message: err.message });
    }

    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }

    res.status(500).json({ message: "Failed to create order" });
  }
};

export const markAsPaid = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);

    if (!order) return res.status(404).json({ message: "Order not found" });

    const isAdmin = req.user?.role === "admin";
    if (!isAdmin) {
      return res.status(403).json({
        message: "Online payments must be confirmed by an admin or payment webhook",
      });
    }

    if (order.paymentMethod === "mobile_money") {
      return res.status(400).json({
        message: "Mobile money orders must be confirmed through Snippe status checks or webhooks",
      });
    }

    if (order.isPaid) return res.status(400).json({ message: "Order already paid" });

    if (!canTransition(order.status, "paid")) {
      return res.status(400).json({
        message: `Cannot move from ${order.status} → paid`,
      });
    }

    await markOrderPaidInternally(order);

    const fullOrder = await Order.findByPk(order.id, { include: orderIncludes });
    await notifyOrderPaymentCompleted(fullOrder);
    res.json(serializeOrder(fullOrder));
  } catch (err) {
    console.error("MARK PAID ERROR:", err);
    res.status(500).json({ message: "Failed to mark order as paid" });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByPk(req.params.id);

    if (!order) return res.status(404).json({ message: "Order not found" });

    if (!canTransition(order.status, status)) {
      return res.status(400).json({
        message: `Invalid transition ${order.status} → ${status}`,
      });
    }

    await Order.sequelize.transaction(async (transaction) => {
      const transactionalOrder = await Order.findByPk(req.params.id, { transaction });
      transactionalOrder.status = status;

      if (status === "delivered") {
        transactionalOrder.deliveredAt = new Date();
        transactionalOrder.completedAt = new Date();

        if (transactionalOrder.riderId) {
          await Rider.update(
            { available: true },
            { where: { id: transactionalOrder.riderId }, transaction }
          );
        }
      }

      if (status === "cancelled" || status === "refunded") {
        if (transactionalOrder.inventoryReserved) {
          await restoreInventoryForOrder(transactionalOrder.id, transaction);
          transactionalOrder.inventoryReserved = false;
        }

        if (transactionalOrder.riderId) {
          await Rider.update(
            { available: true },
            { where: { id: transactionalOrder.riderId }, transaction }
          );
        }
      }

      await transactionalOrder.save({ transaction });
    });

    const fullOrder = await Order.findByPk(order.id, { include: orderIncludes });
    await notifyOrderStatusChanged(fullOrder);
    res.json(serializeOrder(fullOrder));
  } catch (err) {
    console.error("UPDATE STATUS ERROR:", err);
    res.status(500).json({ message: "Failed to update order status" });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { userId: req.user._id },
      include: orderIncludes,
      order: [["created_at", "DESC"]],
    });

    res.json(orders.map((order) => serializeOrder(order)));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: orderIncludes,
      order: [["created_at", "DESC"]],
    });

    res.json(orders.map((order) => serializeOrder(order)));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

export const refreshOrderPaymentStatus = async (req, res) => {
  try {
    const order = await loadOrderForPaymentAction(req, res);
    if (!order) return;

    const paymentData = await getSnippePaymentStatus(order.paymentReference);
    const previousPaymentStatus = order.paymentStatus;
    const wasPaid = Boolean(order.isPaid);
    await updateOrderFromSnippePayment(order, paymentData);

    const fullOrder = await Order.findByPk(order.id, { include: orderIncludes });
    if (!wasPaid && fullOrder?.isPaid) {
      await notifyOrderPaymentCompleted(fullOrder);
    } else if (
      ["failed", "expired", "voided"].includes(fullOrder?.paymentStatus) &&
      previousPaymentStatus !== fullOrder?.paymentStatus
    ) {
      await notifyOrderPaymentIssue(fullOrder);
    }

    return res.json({
      message: "Payment status refreshed",
      order: serializeOrder(fullOrder),
    });
  } catch (error) {
    console.error("REFRESH PAYMENT STATUS ERROR:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to refresh payment status",
    });
  }
};

export const retryOrderPaymentPush = async (req, res) => {
  try {
    const order = await loadOrderForPaymentAction(req, res);
    if (!order) return;

    if (order.isPaid) {
      return res.status(400).json({ message: "Order is already paid" });
    }

    const retryNetwork = normalizeRequestedMobileNetwork(req.body?.network || order.paymentProvider);
    const phoneValidation = validatePhoneForSelectedNetwork(
      order.deliveryContactPhone,
      retryNetwork
    );

    if (!phoneValidation.valid) {
      return res.status(400).json({ message: phoneValidation.message });
    }

    const normalizedRetryNetwork = normalizeRequestedMobileNetwork(retryNetwork);
    const canReuseExistingReference =
      order.paymentReference &&
      normalizedRetryNetwork &&
      normalizedRetryNetwork === normalizeRequestedMobileNetwork(order.paymentProvider);

    if (canReuseExistingReference) {
      try {
        const paymentData = await triggerSnippePaymentPush(order.paymentReference);
        await updateOrderFromSnippePayment(order, paymentData);

        const fullOrder = await Order.findByPk(order.id, { include: orderIncludes });
        return res.json({
          message: "Mobile money prompt resent",
          paymentIntent: buildSnippePaymentIntentPayload(paymentData, {
            fallbackProvider: normalizedRetryNetwork,
            defaultMessage: "Check your phone and complete the retried mobile money prompt.",
          }),
          order: serializeOrder(fullOrder),
        });
      } catch (error) {
        if (!shouldCreateReplacementPayment(error)) {
          throw error;
        }
      }
    }

    const paymentIntent = await createReplacementMobileMoneyPayment({
      req,
      order,
      requestedNetwork: normalizedRetryNetwork,
    });

    const fullOrder = await Order.findByPk(order.id, { include: orderIncludes });
    return res.json({
      message: "New mobile money prompt created",
      paymentIntent,
      order: serializeOrder(fullOrder),
    });
  } catch (error) {
    console.error("RETRY PAYMENT PUSH ERROR:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to create a new mobile money prompt",
    });
  }
};

export const handleSnippeWebhook = async (req, res) => {
  try {
    const event = req.snippeEvent;
    const orderId = Number(event?.data?.metadata?.order_id);

    await logPaymentAudit({
      orderId: Number.isInteger(orderId) && orderId > 0 ? orderId : null,
      action: "snippe_webhook_received",
      message: `Received Snippe webhook ${event?.type || "unknown"}`,
      meta: {
        provider: "snippe",
        eventType: event?.type || null,
        reference: event?.data?.reference || null,
        paymentStatus: event?.data?.status || null,
        amount: Number(event?.data?.amount?.value || 0) || null,
        rawEvent: event,
      },
    });

    if (!Number.isInteger(orderId) || orderId <= 0) {
      console.warn("SNIPPE WEBHOOK missing valid order_id metadata");
      await logPaymentAudit({
        action: "snippe_webhook_ignored_missing_order",
        message: "Snippe webhook ignored because order_id metadata was missing or invalid",
        meta: {
          provider: "snippe",
          eventType: event?.type || null,
          reference: event?.data?.reference || null,
          rawEvent: event,
        },
      });
      return res.status(200).json({ received: true, ignored: true });
    }

    const order = await Order.findByPk(orderId);
    if (!order) {
      console.warn(`SNIPPE WEBHOOK order not found: ${orderId}`);
      await logPaymentAudit({
        orderId,
        action: "snippe_webhook_ignored_order_not_found",
        message: `Snippe webhook ignored because order ${orderId} was not found`,
        meta: {
          provider: "snippe",
          eventType: event?.type || null,
          reference: event?.data?.reference || null,
          rawEvent: event,
        },
      });
      return res.status(200).json({ received: true, ignored: true });
    }

    if (order.paymentReference && event?.data?.reference && order.paymentReference !== event.data.reference) {
      console.warn(
        `SNIPPE WEBHOOK reference mismatch for order ${order.id}: expected ${order.paymentReference}, got ${event.data.reference}`
      );
      await logPaymentAudit({
        order,
        action: "snippe_webhook_ignored_reference_mismatch",
        message: `Snippe webhook ignored because payment reference did not match order ${order.id}`,
        meta: {
          provider: "snippe",
          eventType: event?.type || null,
          expectedReference: order.paymentReference,
          receivedReference: event?.data?.reference || null,
          rawEvent: event,
        },
      });
      return res.status(200).json({ received: true, ignored: true });
    }

    const webhookAmount = Number(event?.data?.amount?.value || 0);
    const expectedAmount = Math.round(Number(order.totalAmount || 0));

    if (webhookAmount !== expectedAmount) {
      console.error(
        `SNIPPE WEBHOOK amount mismatch for order ${order.id}: expected ${expectedAmount}, got ${webhookAmount}`
      );
      await logPaymentAudit({
        order,
        action: "snippe_webhook_ignored_amount_mismatch",
        message: `Snippe webhook ignored because amount did not match order ${order.id}`,
        meta: {
          provider: "snippe",
          eventType: event?.type || null,
          expectedAmount,
          receivedAmount: webhookAmount,
          reference: event?.data?.reference || null,
          rawEvent: event,
        },
      });
      return res.status(200).json({ received: true, ignored: true });
    }

    order.paymentProvider = event?.data?.channel?.provider || order.paymentProvider || "snippe";
    order.paymentReference = order.paymentReference || event?.data?.reference || null;
    order.paymentStatus = event?.data?.status || event?.type?.replace("payment.", "") || order.paymentStatus;
    order.paymentExpiresAt = event?.data?.expires_at || order.paymentExpiresAt;

    if (event.type === "payment.completed") {
      await markOrderPaidInternally(order);
      const fullOrder = await Order.findByPk(order.id, { include: orderIncludes });
      await notifyOrderPaymentCompleted(fullOrder);
      await logPaymentAudit({
        order: fullOrder,
        action: "snippe_payment_completed",
        message: `Snippe payment completed for order ${order.id}`,
        meta: {
          provider: "snippe",
          eventType: event?.type || null,
          reference: event?.data?.reference || null,
          paymentStatus: event?.data?.status || null,
          rawEvent: event,
        },
      });
      return res.status(200).json({ received: true });
    }

    if (event.type === "payment.failed" || event?.data?.status === "failed") {
      order.paymentFailedAt = new Date();
      order.paymentFailureReason =
        event?.data?.failure_reason || event?.message || "Mobile money payment failed";
      await order.save();
      const fullOrder = await Order.findByPk(order.id, { include: orderIncludes });
      await notifyOrderPaymentIssue(fullOrder);
      await logPaymentAudit({
        order: fullOrder,
        action: "snippe_payment_failed",
        message: `Snippe payment failed for order ${order.id}`,
        meta: {
          provider: "snippe",
          eventType: event?.type || null,
          reference: event?.data?.reference || null,
          paymentStatus: event?.data?.status || null,
          failureReason: event?.data?.failure_reason || event?.message || null,
          rawEvent: event,
        },
      });
      return res.status(200).json({ received: true });
    }

    if (event?.data?.status === "expired" || event?.data?.status === "voided") {
      order.paymentFailureReason =
        event?.data?.status === "expired"
          ? "Mobile money payment expired before confirmation"
          : "Mobile money payment was voided";
      await order.save();
      const fullOrder = await Order.findByPk(order.id, { include: orderIncludes });
      await notifyOrderPaymentIssue(fullOrder);
      await logPaymentAudit({
        order: fullOrder,
        action: `snippe_payment_${event?.data?.status || "updated"}`,
        message: `Snippe payment ${event?.data?.status || "updated"} for order ${order.id}`,
        meta: {
          provider: "snippe",
          eventType: event?.type || null,
          reference: event?.data?.reference || null,
          paymentStatus: event?.data?.status || null,
          rawEvent: event,
        },
      });
      return res.status(200).json({ received: true });
    }

    await logPaymentAudit({
      order,
      action: "snippe_webhook_processed",
      message: `Snippe webhook processed for order ${order.id}`,
      meta: {
        provider: "snippe",
        eventType: event?.type || null,
        reference: event?.data?.reference || null,
        paymentStatus: event?.data?.status || null,
        rawEvent: event,
      },
    });

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("SNIPPE WEBHOOK ERROR:", error);
    return res.status(500).json({ message: "Failed to process webhook" });
  }
};
