import express from "express";
import Notification from "../models/Notification.js";
import Order from "../models/Order.js";
import { verifyToken, adminMiddleware } from "../middleware/authMiddleware.js";
import { createNotificationRecord } from "../utils/createNotificationRecord.js";
import { subscribeToNotificationStream } from "../utils/notificationStream.js";

const router = express.Router();

router.get("/stream", verifyToken, async (req, res) => {
  const requestedAudience = String(req.query?.audience || "").trim().toLowerCase();
  const audience = requestedAudience === "admin" ? "admin" : "customer";

  if (audience === "admin" && req.user?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const unsubscribe = subscribeToNotificationStream({
    audience,
    userId: audience === "customer" ? req.user?._id : null,
    res,
  });

  req.on("close", () => {
    unsubscribe();
  });
});

router.get("/my", verifyToken, async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { audience: "customer" },
      include: [
        {
          model: Order,
          as: "order",
          attributes: ["id", "userId"],
          where: { userId: req.user._id },
          required: true,
        },
      ],
      order: [["created_at", "DESC"]],
      limit: 50,
    });

    res.json(
      notifications.map((notification) => {
        const plain = typeof notification.toJSON === "function" ? notification.toJSON() : notification;
        return {
          _id: plain.id,
          orderId: plain.orderId,
          type: plain.type,
          audience: plain.audience,
          message: plain.message,
          phone: plain.phone,
          read: Boolean(plain.read),
          status: plain.status || "logged",
          createdAt: plain.createdAt || plain.created_at || null,
        };
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch your notifications" });
  }
});

router.patch("/:id/read", verifyToken, async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id, {
      include: [
        {
          model: Order,
          as: "order",
          attributes: ["id", "userId"],
        },
      ],
    });

    if (!notification || !notification.order) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const isCustomerNotification =
      notification.audience === "customer" &&
      String(notification.order.userId) === String(req.user._id);
    const isAdminNotification =
      notification.audience === "admin" && req.user?.role === "admin";

    if (!isCustomerNotification && !isAdminNotification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notification.read = true;
    await notification.save();

    return res.json({
      message: "Notification marked as read",
      notification: {
        _id: notification.id,
        orderId: notification.orderId,
        type: notification.type,
        message: notification.message,
        read: true,
        status: notification.status || "logged",
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update notification" });
  }
});

// GET /api/notifications
router.get("/", verifyToken, adminMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      order: [["created_at", "DESC"]],
      limit: 200,
      where: { audience: "admin" },
    });




    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});


// POST /api/notifications/send
router.post("/send", verifyToken, adminMiddleware, async (req, res) => {
  const { orderId, type = "status", message, phone = null } = req.body;

  if (!message && !orderId) {
    return res.status(400).json({ message: "message or orderId is required" });
  }



  try {
    const order = orderId
      ? await Order.findByPk(orderId, { attributes: ["id", "userId"] })
      : null;

    const notification = await createNotificationRecord({
      orderId: orderId || null,
      type,
      audience: "customer",
      message: message || `Order ${orderId} notification`,
      phone,
      status: "logged",
      userId: order?.userId || null,
    });

    res.status(201).json({ message: "Notification logged", notification });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send notification" });
  }
});



export default router;
