import { Order, User } from "../models/index.js";
import { serializeOrder } from "../utils/serializers.js";

// GET /rider/orders
export const getRiderOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { riderId: req.user._id },
      include: [{ model: User, as: "user", attributes: ["id", "name"] }],
      order: [["createdAt", "DESC"]],
    });

    res.json(orders.map((order) => serializeOrder(order)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

// PUT /rider/orders/:id/status
export const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const VALID_TRANSITIONS = {
    paid: ["out_for_delivery"],
    out_for_delivery: ["delivered"],
  };

  try {
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (String(order.riderId || "") !== String(req.user._id))
      return res.status(403).json({ message: "Not your assigned order" });

    if (!VALID_TRANSITIONS[order.status]?.includes(status))
      return res.status(400).json({ message: "Invalid status transition" });

    order.status = status;
    await order.save();

    res.json({ message: "Order status updated", order: serializeOrder(order) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update status" });
  }
};
