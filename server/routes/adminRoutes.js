import express from "express";
import { verifyToken, adminMiddleware } from "../middleware/authMiddleware.js";
import {
  getAuditLogs,
  sendNotification,
} from "../controllers/adminController.js";

const router = express.Router();

//  Audit logs endpoint
router.get("/audit", verifyToken, adminMiddleware, getAuditLogs);

// Optional: manually trigger notification
router.post("/notifications/send", verifyToken, adminMiddleware, sendNotification);

export default router;
