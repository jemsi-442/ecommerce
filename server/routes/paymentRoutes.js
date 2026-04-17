import express from "express";
import { AuditLog } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { handleSnippeWebhook } from "../controllers/ordersController.js";
import { verifySnippeWebhook } from "../utils/snippe.js";

const router = express.Router();

router.post("/snippe/webhook", (req, res, next) => {
  try {
    req.snippeEvent = verifySnippeWebhook(req.rawBody, req.headers);
    next();
  } catch (error) {
    const auditError = error instanceof ApiError ? error : new ApiError(400, error.message);

    AuditLog.create({
      type: "payment",
      action: "snippe_webhook_rejected",
      message: auditError.message,
      meta: {
        provider: "snippe",
        path: req.originalUrl,
        timestamp: req.headers["x-webhook-timestamp"] || null,
        signaturePresent: Boolean(req.headers["x-webhook-signature"]),
        body: Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : String(req.rawBody || ""),
      },
    }).catch((logError) => {
      console.error("SNIPPE WEBHOOK AUDIT ERROR:", logError);
    });

    next(error instanceof ApiError ? error : new ApiError(400, error.message));
  }
}, handleSnippeWebhook);

export default router;
