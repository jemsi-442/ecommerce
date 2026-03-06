import { Order, Rider, User } from "../models/index.js";
import { assignRider } from "../utils/assignRider.js";
import { canTransition } from "../utils/orderStatusFlow.js";
import { serializeOrder } from "../utils/serializers.js";

const orderIncludes = [
  { model: User, as: "user", attributes: ["id", "name", "email"] },
  { model: Rider, as: "rider", attributes: ["id", "name", "phone"] },
];

/**
 * ===============================
 * CREATE ORDER
 * ===============================
 */
export const createOrder = async (req, res) => {
  try {
    const { items, totalAmount, delivery } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Order items required" });
    }

    if (!delivery?.type || !delivery?.contactPhone) {
      return res.status(400).json({ message: "Delivery type and contactPhone are required" });
    }

    const order = await Order.create({
      userId: req.user._id,
      items,
      totalAmount,
      deliveryType: delivery.type,
      deliveryAddress: delivery.address || null,
      deliveryContactPhone: delivery.contactPhone,
    });

    const fullOrder = await Order.findByPk(order.id, { include: orderIncludes });
    res.status(201).json(serializeOrder(fullOrder));
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    res.status(500).json({ message: "Failed to create order" });
  }
};

/**
 * ===============================
 * MARK ORDER AS PAID
 * → auto assign rider
 * ===============================
 */
export const markAsPaid = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);

    if (!order) return res.status(404).json({ message: "Order not found" });

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

/**
 * ===============================
 * UPDATE ORDER STATUS (ADMIN)
 * ===============================
 */
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

/**
 * ===============================
 * GET MY ORDERS (USER)
 * ===============================
 */
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { userId: req.user._id },
      include: orderIncludes,
      order: [["createdAt", "DESC"]],
    });

    res.json(orders.map((order) => serializeOrder(order)));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

/**
 * ===============================
 * ADMIN – GET ALL ORDERS
 * ===============================
 */
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: orderIncludes,
      order: [["createdAt", "DESC"]],
    });

    res.json(orders.map((order) => serializeOrder(order)));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};
