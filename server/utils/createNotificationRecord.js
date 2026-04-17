import Notification from "../models/Notification.js";
import { enqueueNotificationEvent, publishNotificationEvent } from "./notificationStream.js";

const toPayload = (notification) => ({
  _id: notification.id,
  orderId: notification.orderId,
  type: notification.type,
  audience: notification.audience,
  message: notification.message,
  phone: notification.phone,
  read: Boolean(notification.read),
  status: notification.status || "logged",
  customerName: notification.customerName || null,
  riderName: notification.riderName || null,
  createdAt: notification.createdAt || notification.created_at || null,
});

export const createNotificationRecord = async ({
  orderId = null,
  type,
  audience = "customer",
  message,
  phone = null,
  read = false,
  customerName = null,
  riderName = null,
  status = "logged",
  userId = null,
}) => {
  const notification = await Notification.create({
    orderId,
    type,
    audience,
    message,
    phone,
    read,
    customerName,
    riderName,
    status,
  });

  publishNotificationEvent({
    audience,
    userId,
    notification: toPayload(notification),
  });

  await enqueueNotificationEvent({
    audience,
    userId,
    notificationId: notification.id,
    payload: toPayload(notification),
  });

  return notification;
};
