import Notification from "../models/Notification.js";
import axios from "axios";

// POST /notifications/send
export const sendOrderNotification = async (req, res) => {
  const { orderId, type, message, phone } = req.body;

  try {
    // Save notification to DB
    const notification = await Notification.create({
      orderId,
      type,
      message,
      phone,
    });

    // Send SMS / WhatsApp via Twilio or other API
    // Example using Twilio
    if (phone) {
      await axios.post("https://api.twilio.com/send", {
        to: phone,
        body: message,
      });
    }

    res.status(201).json({ message: "Notification sent", notification });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send notification" });
  }
};

// GET /notifications
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      order: [["createdAt", "DESC"]],
    });
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};
