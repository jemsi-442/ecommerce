import express from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  approveProduct,
  rejectProduct,
  getProductReviews,
  upsertProductReview,
} from "../controllers/productController.js";
import { protect, adminOnly, optionalProtect, requireRole } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";
import { rateLimit } from "../middleware/rateLimiter.js";

const router = express.Router();

const reviewRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `${req.ip}:${req.user?._id || "anon"}:review-product`,
});

router.get("/", optionalProtect, getProducts);
router.get("/:id", optionalProtect, getProductById);
router.get("/:id/reviews", optionalProtect, getProductReviews);
router.post("/:id/reviews", protect, requireRole("customer"), reviewRateLimiter, upsertProductReview);
router.post("/", protect, adminOnly, upload.single("image"), createProduct);
router.put("/:id", protect, adminOnly, upload.single("image"), updateProduct);
router.put("/:id/approve", protect, adminOnly, reviewRateLimiter, approveProduct);
router.put("/:id/reject", protect, adminOnly, reviewRateLimiter, rejectProduct);
router.delete("/:id", protect, adminOnly, deleteProduct);

export default router;
