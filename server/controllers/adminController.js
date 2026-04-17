import { Op } from "sequelize";
import { Order, Notification, User, Rider } from "../models/index.js";
import { createNotificationRecord } from "../utils/createNotificationRecord.js";
import { serializeOrder } from "../utils/serializers.js";

// GET /admin/audit?status=&rider=&date=
export const getAuditLogs = async (req, res) => {
  try {
    const { status, rider, date } = req.query;
    const where = {};

    if (status) where.status = status;
    if (rider) where.riderId = rider;
    if (date) {
      const day = new Date(date);
      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);
      where.createdAt = { [Op.gte]: day, [Op.lt]: nextDay };
    }

    const orders = await Order.findAll({
      where,
      include: [
        { model: User, as: "user", attributes: ["id", "name"] },
        { model: Rider, as: "rider", attributes: ["id", "name"] },
      ],
    });

    const notifications = await Notification.findAll({
      where: { audience: "admin" },
    });

    const logs = [];

    orders.forEach((row) => {
      const o = serializeOrder(row);
      logs.push({
        _id: o._id,
        orderId: o._id,
        userName: o.user?.name,
        riderName: o.delivery?.rider?.name,
        type: "status",
        message: `Order status: ${o.status}`,
        createdAt: o.updatedAt || o.createdAt,
      });
    });

    notifications.forEach((nRow) => {
      const n = typeof nRow.toJSON === "function" ? nRow.toJSON() : nRow;
      logs.push({
        _id: n.id,
        orderId: n.orderId,
        userName: n.customerName,
        riderName: n.riderName || null,
        type: "notification",
        notificationType: n.type,
        audience: n.audience,
        message: n.message,
        status: n.status || "logged",
        read: Boolean(n.read),
        createdAt: n.createdAt,
      });
    });

    logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching audit logs" });
  }
};

// POST /admin/notifications/send
export const sendNotification = async (req, res) => {
  const { orderId } = req.body;

  try {
    const order = await Order.findByPk(orderId, {
      include: [{ model: User, as: "user", attributes: ["id", "name"] }],
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    const notification = await createNotificationRecord({
      orderId,
      audience: "customer",
      customerName: order.user?.name || null,
      type: "SMS",
      message: `Your order ${String(order.id).slice(-5)} is ${order.status}`,
      status: "sent",
      userId: order.user?.id || null,
    });

    res.json({ message: "Notification sent", notification });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send notification" });
  }
};
