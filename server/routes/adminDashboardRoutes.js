import express from "express";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { Order, OrderItem, Product, User } from "../models/index.js";

const router = express.Router();

router.get("/dashboard", protect, adminOnly, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const [orders, totalUsers, totalProducts, orderItems] = await Promise.all([
      Order.findAll({ order: [["created_at", "DESC"]] }),
      User.count(),
      Product.count(),
      OrderItem.findAll({ include: [{ model: Product, as: "product", attributes: ["id", "name"] }] }),
    ]);

    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => o.status === "pending").length;

    const paidOrders = orders.filter((o) => o.isPaid || o.status === "paid" || o.status === "delivered");
    const monthlyPaidOrders = paidOrders.filter((o) => new Date(o.createdAt || o.created_at) >= startOfMonth);

    const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const monthlyRevenue = monthlyPaidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

    const orderStatusMap = new Map();
    orders.forEach((o) => {
      orderStatusMap.set(o.status, (orderStatusMap.get(o.status) || 0) + 1);
    });

    const orderStatusStats = Array.from(orderStatusMap.entries()).map(([status, count]) => ({
      _id: status,
      count,
    }));

    const revenueMap = new Map();
    orders
      .filter((o) => (o.isPaid || o.status === "paid" || o.status === "delivered") && new Date(o.createdAt || o.created_at) >= last30Days)
      .forEach((o) => {
        const key = new Date(o.createdAt || o.created_at).toISOString().slice(0, 10);
        const prev = revenueMap.get(key) || { revenue: 0, orders: 0 };
        prev.revenue += Number(o.totalAmount);
        prev.orders += 1;
        revenueMap.set(key, prev);
      });

    const revenueByDay = Array.from(revenueMap.entries())
      .map(([day, val]) => ({ _id: day, revenue: val.revenue, orders: val.orders }))
      .sort((a, b) => a._id.localeCompare(b._id));

    const soldMap = new Map();
    orderItems.forEach((item) => {
      const productId = item.productId;
      const qty = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      const prev = soldMap.get(productId) || { soldQty: 0, revenue: 0, productName: item.product?.name || "Unknown Product" };
      prev.soldQty += qty;
      prev.revenue += qty * price;
      soldMap.set(productId, prev);
    });

    const topProducts = Array.from(soldMap.values())
      .sort((a, b) => b.soldQty - a.soldQty)
      .slice(0, 5)
      .map((entry) => ({
        name: entry.productName,
        soldQty: entry.soldQty,
        revenue: entry.revenue,
      }));

    const conversionRate = totalUsers > 0 ? ((totalOrders / totalUsers) * 100).toFixed(2) : 0;

    res.json({
      kpis: {
        totalRevenue,
        monthlyRevenue,
        totalOrders,
        pendingOrders,
        totalUsers,
        totalProducts,
        conversionRate,
      },
      orderStatusStats,
      revenueByDay,
      topProducts,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).json({ message: "Dashboard analytics failed" });
  }
});

export default router;
