import express from "express";
import {
  createOrder,
  markAsPaid,
  updateOrderStatus,
  getMyOrders,
  getAllOrders,
  reportDeliveryIssue,
  updateDeliveryIssueStatus,
  refreshOrderPaymentStatus,
  retryOrderPaymentPush,
} from "../controllers/ordersController.js";
import { verifyToken, adminMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// USER
router.post("/", verifyToken, createOrder);
router.get("/my", verifyToken, getMyOrders);
router.get("/my-orders", verifyToken, getMyOrders);
router.put("/:id/pay", verifyToken, markAsPaid);
router.get("/:id/payment-status", verifyToken, refreshOrderPaymentStatus);
router.post("/:id/payment-push", verifyToken, retryOrderPaymentPush);
router.post("/:id/report-delivery-issue", verifyToken, reportDeliveryIssue);

// ADMIN
router.get("/", verifyToken, adminMiddleware, getAllOrders);
router.put("/:id/status", verifyToken, adminMiddleware, updateOrderStatus);
router.patch("/:id/delivery-issue", verifyToken, adminMiddleware, updateDeliveryIssueStatus);

export default router;
