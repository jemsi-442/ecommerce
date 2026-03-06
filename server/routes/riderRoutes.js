import express from "express";
import { Order, Rider, User } from "../models/index.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { assignRider } from "../utils/assignRider.js";
import { serializeOrder } from "../utils/serializers.js";

const router = express.Router();

const riderOnly = async (req, res, next) => {
  const rider = await Rider.findOne({ where: { userId: req.user._id } });
  if (!rider) {
    return res.status(403).json({ message: "Rider access only" });
  }
  req.rider = rider;
  next();
};

router.get("/orders", verifyToken, riderOnly, async (req, res) => {
  const orders = await Order.findAll({
    where: {
      riderId: req.rider.id,
      status: "out_for_delivery",
    },
    include: [{ model: User, as: "user", attributes: ["id", "name", "email"] }],
    order: [["assignedAt", "ASC"]],
  });

  res.json(orders.map((order) => serializeOrder(order)));
});

router.put("/orders/:id/accept", verifyToken, riderOnly, async (req, res) => {
  const order = await Order.findByPk(req.params.id);

  if (!order) return res.status(404).json({ message: "Order not found" });

  if (String(order.riderId || "") !== String(req.rider.id)) {
    return res.status(403).json({ message: "Not assigned to you" });
  }

  if (order.acceptedAt) {
    return res.status(400).json({ message: "Order already accepted" });
  }

  order.acceptedAt = new Date();
  await order.save();

  res.json({
    success: true,
    message: "Delivery accepted",
    order: serializeOrder(order),
  });
});

router.put("/orders/:id/reject", verifyToken, riderOnly, async (req, res) => {
  const order = await Order.findByPk(req.params.id);

  if (!order) return res.status(404).json({ message: "Order not found" });

  if (String(order.riderId || "") !== String(req.rider.id)) {
    return res.status(403).json({ message: "Not assigned to you" });
  }

  req.rider.available = true;
  await req.rider.save();

  const newRiderId = await assignRider();

  if (!newRiderId) {
    order.riderId = null;
    order.status = "paid";
    order.assignedAt = null;
    order.acceptedAt = null;
  } else {
    order.riderId = newRiderId;
    order.assignedAt = new Date();
    order.acceptedAt = null;
    order.status = "out_for_delivery";
  }

  await order.save();

  res.json({
    success: true,
    message: "Delivery rejected & reassigned",
    order: serializeOrder(order),
  });
});

router.put("/orders/:id/delivered", verifyToken, riderOnly, async (req, res) => {
  const order = await Order.findByPk(req.params.id);

  if (!order) return res.status(404).json({ message: "Order not found" });

  if (String(order.riderId || "") !== String(req.rider.id)) {
    return res.status(403).json({ message: "Not assigned to you" });
  }

  order.status = "delivered";
  order.deliveredAt = new Date();
  order.completedAt = new Date();

  req.rider.available = true;
  await req.rider.save();

  await order.save();

  res.json({
    success: true,
    message: "Order delivered successfully",
  });
});

export default router;
