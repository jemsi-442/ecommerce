import express from "express";
import { Op } from "sequelize";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { Notification, NotificationEvent, Order, OrderItem, Product, Rider, User, VendorPayout } from "../models/index.js";
import {
  getNotificationStreamClientCount,
  getNotificationStreamInstanceId,
} from "../utils/notificationStream.js";

const router = express.Router();

router.get("/dashboard", protect, adminOnly, async (req, res) => {
  try {
    const extractAreaLabel = (order) => {
      if (order.deliveryType === "pickup") return "Pickup";
      const rawAddress = String(order.deliveryAddress || "").trim();
      if (!rawAddress) return "Address not set";
      const parts = rawAddress.split(",").map((part) => part.trim()).filter(Boolean);
      return parts[0] || rawAddress;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);

    const [
      orders,
      totalUsers,
      totalProducts,
      orderItems,
      approvedProducts,
      riders,
      unreadAdminNotifications,
      unreadCustomerNotifications,
      recentOutboxEvents,
      latestOutboxEvent,
      vendorPayouts,
    ] = await Promise.all([
      Order.findAll({
        include: [
          { model: User, as: "user", attributes: ["id", "name", "email"], required: false },
          { model: Rider, as: "rider", attributes: ["id", "name", "available", "isActive", "currentOrders", "lastAssignedAt"], required: false },
        ],
        order: [["created_at", "DESC"]],
      }),
      User.count(),
      Product.count(),
      OrderItem.findAll({
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "createdBy", "stock"],
            include: [{ model: User, as: "creator", attributes: ["id", "name", "storeName", "storeSlug"], required: false }],
          },
          { model: Order, as: "order", attributes: ["id", "created_at", "status", "isPaid"] },
        ],
      }),
      Product.findAll({
        where: { status: "approved" },
        include: [{ model: User, as: "creator", attributes: ["id", "name", "storeName", "storeSlug"], required: false }],
        order: [["stock", "ASC"], ["created_at", "DESC"]],
      }),
      Rider.findAll({
        order: [["created_at", "DESC"]],
      }),
      Notification.count({ where: { audience: "admin", read: false } }),
      Notification.count({ where: { audience: "customer", read: false } }),
      NotificationEvent.count({
        where: {
          created_at: { [Op.gte]: lastHour },
        },
      }),
      NotificationEvent.findOne({
        order: [["created_at", "DESC"]],
      }),
      VendorPayout.findAll({
        include: [{ model: User, as: "vendor", attributes: ["id", "name", "storeName", "storeSlug"] }],
        order: [["created_at", "DESC"]],
      }),
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

    const startOfWeek = new Date(today);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    const previousWeekStart = new Date(startOfWeek);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);

    const currentWeekPaidOrders = paidOrders.filter((o) => new Date(o.createdAt || o.created_at) >= startOfWeek);
    const previousWeekPaidOrders = paidOrders.filter((o) => {
      const createdAt = new Date(o.createdAt || o.created_at);
      return createdAt >= previousWeekStart && createdAt < startOfWeek;
    });

    const currentWeekRevenue = currentWeekPaidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const previousWeekRevenue = previousWeekPaidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const weeklyGrowthRate = previousWeekRevenue
      ? Number((((currentWeekRevenue - previousWeekRevenue) / previousWeekRevenue) * 100).toFixed(1))
      : currentWeekRevenue > 0
        ? 100
        : 0;

    const monthlyLeaderboardMap = new Map();
    const vendorGrowthMap = new Map();
    const customerOrderMap = new Map();

    const soldMap = new Map();
    orderItems.forEach((item) => {
      const productId = item.productId;
      const qty = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      const prev = soldMap.get(productId) || { soldQty: 0, revenue: 0, productName: item.product?.name || "Unknown Product" };
      prev.soldQty += qty;
      prev.revenue += qty * price;
      soldMap.set(productId, prev);

      const itemOrder = item.order;
      const orderDate = itemOrder ? new Date(itemOrder.createdAt || itemOrder.created_at) : null;
      const isPaidOrder = Boolean(itemOrder?.isPaid || itemOrder?.status === "paid" || itemOrder?.status === "delivered");
      if (orderDate && !Number.isNaN(orderDate.getTime()) && isPaidOrder) {
        const vendorId = item.product?.creator?.id || item.product?.createdBy || null;
        const vendorName = item.product?.creator?.storeName || item.product?.creator?.name || "Unknown vendor";
        const storeSlug = item.product?.creator?.storeSlug || "store";
        if (vendorId) {
          const vendorEntry = vendorGrowthMap.get(vendorId) || {
            id: vendorId,
            name: vendorName,
            storeSlug,
            currentRevenue: 0,
            previousRevenue: 0,
            currentOrders: 0,
            previousOrders: 0,
          };
          if (orderDate >= startOfMonth) {
            vendorEntry.currentRevenue += qty * price;
            vendorEntry.currentOrders += 1;
          } else if (orderDate >= previousMonthStart && orderDate < startOfMonth) {
            vendorEntry.previousRevenue += qty * price;
            vendorEntry.previousOrders += 1;
          }
          vendorGrowthMap.set(vendorId, vendorEntry);
        }
      }

      if (orderDate && !Number.isNaN(orderDate.getTime()) && orderDate >= startOfMonth && isPaidOrder) {
        const monthlyPrev = monthlyLeaderboardMap.get(productId) || {
          productId,
          name: item.product?.name || "Unknown Product",
          soldQty: 0,
          revenue: 0,
          orders: 0,
        };
        monthlyPrev.soldQty += qty;
        monthlyPrev.revenue += qty * price;
        monthlyPrev.orders += 1;
        monthlyLeaderboardMap.set(productId, monthlyPrev);
      }
    });

    orders.forEach((order) => {
      if (!order.userId) return;
      const orderDate = new Date(order.createdAt || order.created_at);
      if (Number.isNaN(orderDate.getTime())) return;
      const isPaidOrder = Boolean(order.isPaid || order.status === "paid" || order.status === "delivered");
      const entry = customerOrderMap.get(order.userId) || {
        id: order.userId,
        name: order.user?.name || `Customer #${order.userId}`,
        email: order.user?.email || null,
        totalOrders: 0,
        totalPaidRevenue: 0,
        firstOrderAt: orderDate,
        currentMonthOrders: 0,
        currentMonthPaidRevenue: 0,
      };
      entry.totalOrders += 1;
      if (isPaidOrder) entry.totalPaidRevenue += Number(order.totalAmount || 0);
      if (orderDate < entry.firstOrderAt) entry.firstOrderAt = orderDate;
      if (orderDate >= startOfMonth) {
        entry.currentMonthOrders += 1;
        if (isPaidOrder) entry.currentMonthPaidRevenue += Number(order.totalAmount || 0);
      }
      customerOrderMap.set(order.userId, entry);
    });

    const topProducts = Array.from(soldMap.values())
      .sort((a, b) => b.soldQty - a.soldQty)
      .slice(0, 5)
      .map((entry) => ({
        name: entry.productName,
        soldQty: entry.soldQty,
        revenue: entry.revenue,
      }));

    const monthlyLeaderboard = Array.from(monthlyLeaderboardMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((entry) => ({
        ...entry,
        revenue: Number(entry.revenue.toFixed(2)),
      }));

    const areaMap = new Map();
    const paymentTrendMap = new Map();
    const paymentOutcomeTotals = {
      completed: 0,
      failed: 0,
      pending: 0,
    };

    const paymentTrendStart = new Date(today);
    paymentTrendStart.setDate(paymentTrendStart.getDate() - 6);
    paymentTrendStart.setHours(0, 0, 0, 0);

    orders.forEach((order) => {
      const orderDate = new Date(order.createdAt || order.created_at);
      if (Number.isNaN(orderDate.getTime())) return;

      const areaLabel = extractAreaLabel(order);
      const areaEntry = areaMap.get(areaLabel) || {
        label: areaLabel,
        orders: 0,
        paidRevenue: 0,
      };
      areaEntry.orders += 1;
      if (order.isPaid || order.status === "paid" || order.status === "delivered") {
        areaEntry.paidRevenue += Number(order.totalAmount || 0);
      }
      areaMap.set(areaLabel, areaEntry);

      const paymentStatus = String(order.paymentStatus || "").toLowerCase();
      let paymentBucket = "pending";
      if (order.isPaid || order.status === "paid" || order.status === "delivered" || paymentStatus === "completed") paymentBucket = "completed";
      else if (["failed", "expired", "voided", "cancelled"].includes(paymentStatus) || order.paymentFailedAt) paymentBucket = "failed";

      paymentOutcomeTotals[paymentBucket] += 1;

      if (orderDate >= paymentTrendStart) {
        const key = orderDate.toISOString().slice(0, 10);
        const trendEntry = paymentTrendMap.get(key) || { date: key, completed: 0, failed: 0, pending: 0 };
        trendEntry[paymentBucket] += 1;
        paymentTrendMap.set(key, trendEntry);
      }
    });

    const riderMap = new Map();
    const cancelRefundTrendMap = new Map();
    const operationTrendStart = new Date(today);
    operationTrendStart.setDate(operationTrendStart.getDate() - 6);
    operationTrendStart.setHours(0, 0, 0, 0);

    riders.forEach((rider) => {
      riderMap.set(rider.id, {
        id: rider.id,
        name: rider.name,
        available: Boolean(rider.available),
        isActive: Boolean(rider.isActive),
        currentOrders: Number(rider.currentOrders || 0),
        lastAssignedAt: rider.lastAssignedAt || null,
        deliveredCount: 0,
        activeAssignments: 0,
      });
    });

    const deliveredDurations = [];
    let cancelledOrders = 0;
    let refundedOrders = 0;

    orders.forEach((order) => {
      const createdAt = new Date(order.createdAt || order.created_at);
      if (!Number.isNaN(createdAt.getTime()) && createdAt >= operationTrendStart) {
        const key = createdAt.toISOString().slice(0, 10);
        const trendEntry = cancelRefundTrendMap.get(key) || { date: key, cancelled: 0, refunded: 0 };
        if (order.status === "cancelled") trendEntry.cancelled += 1;
        if (order.status === "refunded") trendEntry.refunded += 1;
        cancelRefundTrendMap.set(key, trendEntry);
      }

      if (order.status === "cancelled") cancelledOrders += 1;
      if (order.status === "refunded") refundedOrders += 1;

      if (order.riderId) {
        const riderEntry = riderMap.get(order.riderId) || {
          id: order.riderId,
          name: order.rider?.name || `Rider #${order.riderId}`,
          available: Boolean(order.rider?.available),
          isActive: Boolean(order.rider?.isActive),
          currentOrders: Number(order.rider?.currentOrders || 0),
          lastAssignedAt: order.rider?.lastAssignedAt || null,
          deliveredCount: 0,
          activeAssignments: 0,
        };

        if (["pending", "paid", "out_for_delivery"].includes(order.status)) {
          riderEntry.activeAssignments += 1;
        }
        if (order.status === "delivered") {
          riderEntry.deliveredCount += 1;
        }
        riderMap.set(order.riderId, riderEntry);
      }

      if (order.status === "delivered") {
        const finishedAt = order.deliveredAt || order.completedAt || null;
        const endDate = finishedAt ? new Date(finishedAt) : null;
        if (endDate && !Number.isNaN(endDate.getTime())) {
          const hours = (endDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          if (!Number.isNaN(hours) && hours >= 0) deliveredDurations.push(hours);
        }
      }
    });

    const customerInsightsSource = Array.from(customerOrderMap.values()).map((entry) => ({
      ...entry,
      totalPaidRevenue: Number(entry.totalPaidRevenue.toFixed(2)),
      currentMonthPaidRevenue: Number(entry.currentMonthPaidRevenue.toFixed(2)),
      firstOrderAt: entry.firstOrderAt instanceof Date ? entry.firstOrderAt.toISOString() : entry.firstOrderAt,
    }));

    const totalBuyingCustomers = customerInsightsSource.length;
    const repeatBuyers = customerInsightsSource.filter((entry) => entry.totalOrders >= 2).length;
    const newCustomersThisMonth = customerInsightsSource.filter((entry) => new Date(entry.firstOrderAt) >= startOfMonth).length;
    const returningCustomersThisMonth = customerInsightsSource.filter((entry) => new Date(entry.firstOrderAt) < startOfMonth && entry.currentMonthOrders > 0).length;
    const repeatBuyerRate = totalBuyingCustomers ? Number(((repeatBuyers / totalBuyingCustomers) * 100).toFixed(1)) : 0;
    const newCustomerRevenue = Number(customerInsightsSource
      .filter((entry) => new Date(entry.firstOrderAt) >= startOfMonth)
      .reduce((sum, entry) => sum + Number(entry.currentMonthPaidRevenue || 0), 0)
      .toFixed(2));
    const returningCustomerRevenue = Number(customerInsightsSource
      .filter((entry) => new Date(entry.firstOrderAt) < startOfMonth)
      .reduce((sum, entry) => sum + Number(entry.currentMonthPaidRevenue || 0), 0)
      .toFixed(2));
    const topRepeatBuyers = customerInsightsSource
      .filter((entry) => entry.totalOrders >= 2)
      .sort((a, b) => b.totalOrders - a.totalOrders || b.totalPaidRevenue - a.totalPaidRevenue)
      .slice(0, 5);

    const averageOrderValue = paidOrders.length
      ? Number((totalRevenue / paidOrders.length).toFixed(2))
      : 0;
    const monthlyAverageOrderValue = monthlyPaidOrders.length
      ? Number((monthlyRevenue / monthlyPaidOrders.length).toFixed(2))
      : 0;

    const topDeliveryAreas = Array.from(areaMap.values())
      .sort((a, b) => b.orders - a.orders || b.paidRevenue - a.paidRevenue)
      .slice(0, 5)
      .map((entry) => ({
        ...entry,
        paidRevenue: Number(entry.paidRevenue.toFixed(2)),
      }));

    const paymentTrend = Array.from(paymentTrendMap.values())
      .sort((a, b) => a.date.localeCompare(b.date));

    const paymentAttempts = paymentOutcomeTotals.completed + paymentOutcomeTotals.failed + paymentOutcomeTotals.pending;
    const paymentSuccessRate = paymentAttempts
      ? Number(((paymentOutcomeTotals.completed / paymentAttempts) * 100).toFixed(1))
      : 0;

    const averageDeliveryHours = deliveredDurations.length
      ? Number((deliveredDurations.reduce((sum, value) => sum + value, 0) / deliveredDurations.length).toFixed(1))
      : null;
    const fastestDeliveryHours = deliveredDurations.length ? Number(Math.min(...deliveredDurations).toFixed(1)) : null;
    const slowestDeliveryHours = deliveredDurations.length ? Number(Math.max(...deliveredDurations).toFixed(1)) : null;
    const cancellationRate = totalOrders ? Number(((cancelledOrders / totalOrders) * 100).toFixed(1)) : 0;
    const refundRate = totalOrders ? Number(((refundedOrders / totalOrders) * 100).toFixed(1)) : 0;

    const riderWorkload = Array.from(riderMap.values())
      .sort((a, b) => b.activeAssignments - a.activeAssignments || b.deliveredCount - a.deliveredCount || b.currentOrders - a.currentOrders)
      .slice(0, 5);

    const cancelRefundTrend = Array.from(cancelRefundTrendMap.values())
      .sort((a, b) => a.date.localeCompare(b.date));

    const lowStockProducts = approvedProducts
      .filter((product) => Number(product.stock || 0) <= 5)
      .slice(0, 5)
      .map((product) => ({
        id: product.id,
        name: product.name,
        stock: Number(product.stock || 0),
        vendorName: product.creator?.storeName || product.creator?.name || "In-house",
        storeSlug: product.creator?.storeSlug || null,
        soldQty: soldMap.get(product.id)?.soldQty || 0,
      }));

    const slowMovers = approvedProducts
      .map((product) => {
        const sales = soldMap.get(product.id) || { soldQty: 0, revenue: 0 };
        return {
          id: product.id,
          name: product.name,
          stock: Number(product.stock || 0),
          soldQty: Number(sales.soldQty || 0),
          revenue: Number(Number(sales.revenue || 0).toFixed(2)),
          vendorName: product.creator?.storeName || product.creator?.name || "In-house",
          storeSlug: product.creator?.storeSlug || null,
        };
      })
      .filter((product) => product.stock > 0)
      .sort((a, b) => a.soldQty - b.soldQty || a.revenue - b.revenue || b.stock - a.stock)
      .slice(0, 5);

    const vendorGrowthLeaderboard = Array.from(vendorGrowthMap.values())
      .filter((entry) => entry.currentRevenue > 0 || entry.previousRevenue > 0)
      .map((entry) => ({
        ...entry,
        currentRevenue: Number(entry.currentRevenue.toFixed(2)),
        previousRevenue: Number(entry.previousRevenue.toFixed(2)),
        growthRate: entry.previousRevenue
          ? Number((((entry.currentRevenue - entry.previousRevenue) / entry.previousRevenue) * 100).toFixed(1))
          : entry.currentRevenue > 0
            ? 100
            : 0,
      }))
      .sort((a, b) => b.growthRate - a.growthRate || b.currentRevenue - a.currentRevenue)
      .slice(0, 5);

    const conversionRate = totalUsers > 0 ? ((totalOrders / totalUsers) * 100).toFixed(2) : 0;
    const payoutTotals = {
      totalPaid: 0,
      pendingAmount: 0,
      onHoldAmount: 0,
      totalRecords: vendorPayouts.length,
    };
    const payoutVendorMap = new Map();
    const settlementDays = [];

    vendorPayouts.forEach((row) => {
      const payout = typeof row.toJSON === "function" ? row.toJSON() : row;
      const amount = Number(payout.amount || 0);

      if (payout.status === "paid") payoutTotals.totalPaid += amount;
      else if (payout.status === "on_hold") payoutTotals.onHoldAmount += amount;
      else payoutTotals.pendingAmount += amount;

      const vendorId = payout.vendor?.id || payout.vendorId;
      const vendorName = payout.vendor?.storeName || payout.vendor?.name || "Unknown vendor";
      const storeSlug = payout.vendor?.storeSlug || "store";
      if (!payoutVendorMap.has(vendorId)) {
        payoutVendorMap.set(vendorId, {
          id: vendorId,
          name: vendorName,
          storeSlug,
          total: 0,
          paid: 0,
          pending: 0,
          onHold: 0,
          records: 0,
        });
      }

      const vendorEntry = payoutVendorMap.get(vendorId);
      vendorEntry.total += amount;
      vendorEntry.records += 1;
      if (payout.status === "paid") vendorEntry.paid += amount;
      else if (payout.status === "on_hold") vendorEntry.onHold += amount;
      else vendorEntry.pending += amount;

      if (payout.status === "paid" && payout.createdAt && payout.paidAt) {
        const days = (new Date(payout.paidAt).getTime() - new Date(payout.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (!Number.isNaN(days) && days >= 0) settlementDays.push(days);
      }
    });

    const topPayoutVendors = Array.from(payoutVendorMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((entry) => ({
        ...entry,
        total: Number(entry.total.toFixed(2)),
        paid: Number(entry.paid.toFixed(2)),
        pending: Number(entry.pending.toFixed(2)),
        onHold: Number(entry.onHold.toFixed(2)),
      }));

    const payoutWatchlist = Array.from(payoutVendorMap.values())
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        storeSlug: entry.storeSlug,
        pending: Number(entry.pending.toFixed(2)),
        onHold: Number(entry.onHold.toFixed(2)),
        atRisk: Number((entry.pending + entry.onHold).toFixed(2)),
        records: entry.records,
      }))
      .filter((entry) => entry.atRisk > 0)
      .sort((a, b) => b.atRisk - a.atRisk)
      .slice(0, 5);

    const settlementPerformance = {
      averageDays: settlementDays.length
        ? Number((settlementDays.reduce((sum, value) => sum + value, 0) / settlementDays.length).toFixed(1))
        : null,
      fastestDays: settlementDays.length ? Number(Math.min(...settlementDays).toFixed(1)) : null,
      slowestDays: settlementDays.length ? Number(Math.max(...settlementDays).toFixed(1)) : null,
      settledCount: settlementDays.length,
    };

    const payoutGrossValue = payoutTotals.totalPaid + payoutTotals.pendingAmount + payoutTotals.onHoldAmount;
    const payoutExposureRate = payoutGrossValue
      ? Number((((payoutTotals.pendingAmount + payoutTotals.onHoldAmount) / payoutGrossValue) * 100).toFixed(1))
      : 0;

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
      notifications: {
        unreadAdminNotifications,
        unreadCustomerNotifications,
        recentOutboxEvents,
        latestOutboxEventAt: latestOutboxEvent?.createdAt || latestOutboxEvent?.created_at || null,
        activeStreamClients: getNotificationStreamClientCount(),
        activeAdminStreamClients: getNotificationStreamClientCount({ audience: "admin" }),
        activeCustomerStreamClients: getNotificationStreamClientCount({ audience: "customer" }),
        relayInstanceId: getNotificationStreamInstanceId(),
      },
      orderStatusStats,
      revenueByDay,
      topProducts,
      salesInsights: {
        weeklyMomentum: {
          currentWeekRevenue: Number(currentWeekRevenue.toFixed(2)),
          previousWeekRevenue: Number(previousWeekRevenue.toFixed(2)),
          growthRate: weeklyGrowthRate,
          currentWeekOrders: currentWeekPaidOrders.length,
          previousWeekOrders: previousWeekPaidOrders.length,
          averageDailyRevenue: Number((currentWeekRevenue / 7).toFixed(2)),
        },
        monthlyLeaderboard,
        inventorySignals: {
          lowStockProducts,
          slowMovers,
          lowStockCount: approvedProducts.filter((product) => Number(product.stock || 0) <= 5).length,
        },
        vendorGrowthLeaderboard,
        customerInsights: {
          totalBuyingCustomers,
          repeatBuyers,
          repeatBuyerRate,
          newCustomersThisMonth,
          returningCustomersThisMonth,
          newCustomerRevenue,
          returningCustomerRevenue,
          topRepeatBuyers,
        },
        orderValueInsights: {
          averageOrderValue,
          monthlyAverageOrderValue,
          topDeliveryAreas,
        },
        paymentInsights: {
          successRate: paymentSuccessRate,
          completed: paymentOutcomeTotals.completed,
          failed: paymentOutcomeTotals.failed,
          pending: paymentOutcomeTotals.pending,
          trend: paymentTrend,
        },
        operationsInsights: {
          averageDeliveryHours,
          fastestDeliveryHours,
          slowestDeliveryHours,
          cancellationRate,
          refundRate,
          cancelledOrders,
          refundedOrders,
          riderWorkload,
          cancelRefundTrend,
        },
      },
      payouts: {
        ...payoutTotals,
        topVendors: topPayoutVendors,
        watchlistVendors: payoutWatchlist,
        exposureRate: payoutExposureRate,
        settlementPerformance,
      },
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).json({ message: "Dashboard analytics failed" });
  }
});

export default router;
