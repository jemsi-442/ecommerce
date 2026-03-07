import express from "express";
import Notification from "../models/Notification.js";
import { verifyToken, adminMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/notifications
router.get("/", verifyToken, adminMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      order: [["created_at", "DESC"]],
      limit: 200,
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
    const notification = await Notification.create({
      orderId: orderId || null,
      type,
      message: message || `Order ${orderId} notification`,
      phone,
      status: "logged",
    });

    res.status(201).json({ message: "Notification logged", notification });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send notification" });
  }
});



export default router;
