import { Notification, Order, Rider, User } from "../models/index.js";
import { createNotificationRecord } from "./createNotificationRecord.js";

const orderContextIncludes = [
  { model: User, as: "user", attributes: ["id", "name", "email"] },
  { model: Rider, as: "rider", attributes: ["id", "name", "phone"] },
];

const formatOrderNumber = (orderId) => `#${String(orderId || "").slice(-6)}`;

const formatStatusLabel = (status = "") =>
  String(status || "")
    .replaceAll("_", " ")
    .trim();

const ensureOrderContext = async (order) => {
  if (!order?.id) {
    return null;
  }

  if (order.user && (order.status !== "out_for_delivery" || order.rider)) {
    return order;
  }

  return Order.findByPk(order.id, { include: orderContextIncludes });
};

const ensureNotification = async ({
  order,
  type,
  audience = "customer",
  message,
  status = "logged",
  read = false,
}) => {
  if (!order?.id || !type || !message) {
    return null;
  }

  const existing = await Notification.findOne({
    where: {
      orderId: order.id,
      type,
      message,
    },
  });

  if (existing) {
    return existing;
  }

  return createNotificationRecord({
    orderId: order.id,
    type,
    audience,
    message,
    phone: order.deliveryContactPhone || null,
    customerName: order.user?.name || null,
    riderName: order.rider?.name || null,
    status,
    read,
    userId: audience === "customer" ? order.user?.id || null : null,
  });
};

const createNotificationPair = async ({ order, customer, admin }) => {
  const context = await ensureOrderContext(order);
  if (!context) {
    return [];
  }

  const jobs = [];

  if (customer?.message) {
    jobs.push(
      ensureNotification({
        order: context,
        type: customer.type,
        audience: "customer",
        message: customer.message,
        status: customer.status,
      })
    );
  }

  if (admin?.message) {
    jobs.push(
      ensureNotification({
        order: context,
        type: admin.type,
        audience: "admin",
        message: admin.message,
        status: admin.status,
      })
    );
  }

  return Promise.all(jobs);
};

export const notifyOrderAwaitingPayment = async (order) => {
  const orderNumber = formatOrderNumber(order?.id);

  return createNotificationPair({
    order,
    customer: {
      type: "customer_payment_pending",
      message: `We received your order ${orderNumber}. Complete the mobile money confirmation on your phone.`,
    },
    admin: {
      type: "admin_payment_pending",
      message: `Order ${orderNumber} has been created and is waiting for mobile money payment confirmation.`,
    },
  });
};

export const notifyOrderPaymentCompleted = async (order) => {
  const context = await ensureOrderContext(order);
  const orderNumber = formatOrderNumber(context?.id);
  const riderSuffix = context?.status === "out_for_delivery" && context?.rider?.name
    ? ` Rider ${context.rider.name} has been assigned to this delivery.`
    : "";

  return createNotificationPair({
    order: context,
    customer: {
      type: "customer_payment_completed",
      message: `Payment for your order ${orderNumber} has been confirmed.${riderSuffix}`,
    },
    admin: {
      type: "admin_payment_completed",
      message: `Payment for order ${orderNumber} has been confirmed.${riderSuffix}`,
    },
  });
};

export const notifyOrderPaymentIssue = async (order) => {
  const context = await ensureOrderContext(order);
  const orderNumber = formatOrderNumber(context?.id);
  const issue =
    context?.paymentFailureReason ||
    (context?.paymentStatus ? `Payment status is ${formatStatusLabel(context.paymentStatus)}` : null) ||
    "There was a mobile money confirmation issue";

  return createNotificationPair({
    order: context,
    customer: {
      type: "customer_payment_issue",
      message: `Payment for your order ${orderNumber} needs attention: ${issue}.`,
    },
    admin: {
      type: "admin_payment_issue",
      message: `Order ${orderNumber} has a payment issue: ${issue}.`,
    },
  });
};

export const notifyOrderStatusChanged = async (order) => {
  const context = await ensureOrderContext(order);
  const orderNumber = formatOrderNumber(context?.id);
  const statusLabel = formatStatusLabel(context?.status || "pending");
  const riderSuffix = context?.status === "out_for_delivery" && context?.rider?.name
    ? ` Rider ${context.rider.name} yuko assigned.`
    : "";

  return createNotificationPair({
    order: context,
    customer: {
      type: "customer_order_status",
      message: `Order yako ${orderNumber} sasa ipo ${statusLabel}.${riderSuffix}`,
    },
    admin: {
      type: "admin_order_status",
      message: `Order ${orderNumber} imehamishwa kwenda ${statusLabel}.${riderSuffix}`,
    },
  });
};
