import express from "express";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { Order, User, Product } from "../models/index.js";

const router = express.Router();

router.get("/dashboard", protect, adminOnly, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const [orders, totalUsers, totalProducts] = await Promise.all([
      Order.findAll({ order: [["createdAt", "DESC"]] }),
      User.count(),
      Product.count(),
    ]);

    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => o.status === "pending").length;

    const paidOrders = orders.filter((o) => o.isPaid);
    const monthlyPaidOrders = paidOrders.filter((o) => new Date(o.createdAt) >= startOfMonth);

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
      .filter((o) => o.isPaid && new Date(o.createdAt) >= last30Days)
      .forEach((o) => {
        const key = new Date(o.createdAt).toISOString().slice(0, 10);
        const prev = revenueMap.get(key) || { revenue: 0, orders: 0 };
        prev.revenue += Number(o.totalAmount);
        prev.orders += 1;
        revenueMap.set(key, prev);
      });

    const revenueByDay = Array.from(revenueMap.entries())
      .map(([day, val]) => ({ _id: day, revenue: val.revenue, orders: val.orders }))
      .sort((a, b) => a._id.localeCompare(b._id));

    const soldMap = new Map();
    orders.forEach((o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      items.forEach((item) => {
        const productId = item.product;
        const qty = Number(item.qty || item.quantity || 0);
        const price = Number(item.price || 0);
        const prev = soldMap.get(productId) || { soldQty: 0, revenue: 0 };
        prev.soldQty += qty;
        prev.revenue += qty * price;
        soldMap.set(productId, prev);
      });
    });

    const topSold = Array.from(soldMap.entries())
      .map(([productId, stat]) => ({ productId, ...stat }))
      .sort((a, b) => b.soldQty - a.soldQty)
      .slice(0, 5);

    const topProducts = await Promise.all(
      topSold.map(async (entry) => {
        const product = await Product.findByPk(entry.productId);
        return {
          name: product?.name || "Unknown Product",
          soldQty: entry.soldQty,
          revenue: entry.revenue,
        };
      })
    );

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
