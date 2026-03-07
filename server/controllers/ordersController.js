import { Order, OrderItem, Product, Rider, User } from "../models/index.js";
import { assignRider } from "../utils/assignRider.js";
import { canTransition } from "../utils/orderStatusFlow.js";
import { serializeOrder } from "../utils/serializers.js";

const orderIncludes = [
  { model: User, as: "user", attributes: ["id", "name", "email"] },
  { model: Rider, as: "rider", attributes: ["id", "name", "phone"] },
  {
    model: OrderItem,
    as: "items",
    include: [{ model: Product, as: "product", attributes: ["id", "name"] }],
  },
];

export const createOrder = async (req, res) => {
  try {
    const { items, totalAmount, delivery, payment } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Order items required" });
    }

    if (!delivery?.type || !delivery?.contactPhone) {
      return res.status(400).json({ message: "Delivery type and contactPhone are required" });
    }

    const order = await Order.create({
      userId: req.user._id,
      totalAmount,
      deliveryType: delivery.type,
      deliveryAddress: delivery.address || null,
      deliveryContactPhone: delivery.contactPhone,
      paymentMethod:
        payment?.method === "cash" ? "cash_on_delivery" : payment?.method || "cash_on_delivery",
    });

    const normalizedItems = items.map((item) => ({
      orderId: order.id,
      productId: Number(item.product),
      quantity: Number(item.qty || item.quantity || 1),
      price: Number(item.price || 0),
    }));

    await OrderItem.bulkCreate(normalizedItems);

    // For cash-on-delivery home deliveries, dispatch immediately if a rider is available.
    if (delivery.type === "home" && ["cash", "cash_on_delivery"].includes(payment?.method || "cash")) {
      const riderId = await assignRider();

      if (riderId) {
        order.riderId = riderId;
        order.assignedAt = new Date();
        order.status = "out_for_delivery";
        await order.save();
      }
    }

    const fullOrder = await Order.findByPk(order.id, { include: orderIncludes });
    res.status(201).json(serializeOrder(fullOrder));
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    res.status(500).json({ message: "Failed to create order" });
  }
};

export const markAsPaid = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);

    if (!order) return res.status(404).json({ message: "Order not found" });

    const isAdmin = req.user?.role === "admin";
    const isOwner = String(order.userId) === String(req.user?._id);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (order.isPaid) return res.status(400).json({ message: "Order already paid" });

    if (!canTransition(order.status, "paid")) {
      return res.status(400).json({
        message: `Cannot move from ${order.status} → paid`,
      });
    }

    order.status = "paid";
    order.isPaid = true;
    order.paidAt = new Date();

    if (order.deliveryType === "home") {
      const riderId = await assignRider();

      if (riderId) {
        order.riderId = riderId;
        order.assignedAt = new Date();
        order.status = "out_for_delivery";
      }
    }

    await order.save();

    const fullOrder = await Order.findByPk(order.id, { include: orderIncludes });
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

    order.status = status;

    if (status === "delivered") {
      order.deliveredAt = new Date();
      order.completedAt = new Date();

      if (order.riderId) {
        await Rider.update({ available: true }, { where: { id: order.riderId } });
      }
    }

    if (status === "cancelled" || status === "refunded") {
      if (order.riderId) {
        await Rider.update({ available: true }, { where: { id: order.riderId } });
      }
    }

    await order.save();

    const fullOrder = await Order.findByPk(order.id, { include: orderIncludes });
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
