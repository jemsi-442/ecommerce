import express from "express";
import { Op } from "sequelize";
import { Order, OrderItem, Product, Rider, User } from "../models/index.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { assignRider, getOrderVendorRiderScope } from "../utils/assignRider.js";
import { serializeOrder } from "../utils/serializers.js";

const router = express.Router();

const serializeRiderProfile = (rider) => {
  if (!rider) return null;

  return {
    id: rider.id,
    _id: rider.id,
    name: rider.name,
    phone: rider.phone,
    available: Boolean(rider.available),
    isActive: Boolean(rider.isActive),
    currentOrders: Number(rider.currentOrders || 0),
    lastAssignedAt: rider.lastAssignedAt || null,
    createdAt: rider.createdAt || rider.created_at || null,
    user: rider.user
      ? {
          id: rider.user.id,
          _id: rider.user.id,
          name: rider.user.name,
          email: rider.user.email,
          phone: rider.user.phone || null,
          createdAt: rider.user.createdAt || rider.user.created_at || null,
        }
      : null,
    vendor: rider.vendor
      ? {
          id: rider.vendor.id,
          _id: rider.vendor.id,
          name: rider.vendor.name,
          storeName: rider.vendor.storeName || null,
          storeSlug: rider.vendor.storeSlug || null,
          businessPhone: rider.vendor.businessPhone || null,
        }
      : null,
  };
};

const riderOnly = async (req, res, next) => {
  const rider = await Rider.findOne({ where: { userId: req.user._id } });
  if (!rider) {
    return res.status(403).json({ message: "Rider access only" });
  }
  if (!rider.isActive) {
    return res.status(403).json({ message: "Rider account is inactive" });
  }
  req.rider = rider;
  next();
};

router.get("/orders", verifyToken, riderOnly, async (req, res) => {
  const orders = await Order.findAll({
    where: {
      riderId: req.rider.id,
      status: {
        [Op.in]: ["out_for_delivery"],
      },
    },
    include: [
      { model: User, as: "user", attributes: ["id", "name", "email", "phone"] },
      {
        model: OrderItem,
        as: "items",
        attributes: ["id", "productId", "quantity", "price"],
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "image", "createdBy"],
            include: [
              {
                model: User,
                as: "creator",
                attributes: ["id", "name", "storeName", "storeSlug", "businessPhone"],
              },
            ],
          },
        ],
      },
    ],
    order: [["assigned_at", "ASC"]],
  });

  res.json(orders.map((order) => serializeOrder(order)));
});

router.get("/profile", verifyToken, riderOnly, async (req, res) => {
  const rider = await Rider.findByPk(req.rider.id, {
    include: [
      { model: User, as: "user", attributes: ["id", "name", "email", "phone"] },
      { model: User, as: "vendor", attributes: ["id", "name", "storeName", "storeSlug", "businessPhone"] },
    ],
  });

  return res.json({
    data: serializeRiderProfile(rider),
  });
});

router.patch("/status", verifyToken, riderOnly, async (req, res) => {
  const nextAvailable = req.body?.available;

  if (typeof nextAvailable !== "boolean") {
    return res.status(400).json({ message: "available must be true or false" });
  }

  req.rider.available = nextAvailable;
  await req.rider.save();

  const rider = await Rider.findByPk(req.rider.id, {
    include: [
      { model: User, as: "user", attributes: ["id", "name", "email", "phone"] },
      { model: User, as: "vendor", attributes: ["id", "name", "storeName", "storeSlug", "businessPhone"] },
    ],
  });

  return res.json({
    message: nextAvailable ? "You are now available for new deliveries" : "You are paused from new deliveries",
    data: serializeRiderProfile(rider),
  });
});

router.get("/history", verifyToken, riderOnly, async (req, res) => {
  const orders = await Order.findAll({
    where: {
      riderId: req.rider.id,
      status: {
        [Op.in]: ["delivered"],
      },
    },
    include: [
      { model: User, as: "user", attributes: ["id", "name", "email", "phone"] },
      {
        model: OrderItem,
        as: "items",
        attributes: ["id", "productId", "quantity", "price"],
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "image", "createdBy"],
            include: [
              {
                model: User,
                as: "creator",
                attributes: ["id", "name", "storeName", "storeSlug", "businessPhone"],
              },
            ],
          },
        ],
      },
    ],
    order: [["delivered_at", "DESC"], ["id", "DESC"]],
    limit: 100,
  });

  res.json({
    orders: orders.map((order) => serializeOrder(order)),
  });
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

  const vendorId = await getOrderVendorRiderScope(order.id);
  const newRiderId = await assignRider({ vendorId });

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

  const proofRecipient = String(req.body?.recipientName || "").trim();
  const proofNote = String(req.body?.deliveryNote || "").trim();

  order.status = "delivered";
  order.deliveredAt = new Date();
  order.completedAt = new Date();
  order.deliveryProofRecipient = proofRecipient || null;
  order.deliveryProofNote = proofNote || null;

  req.rider.available = true;
  await req.rider.save();

  await order.save();

  res.json({
    success: true,
    message: "Order delivered successfully",
  });
});

export default router;
