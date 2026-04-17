import express from "express";
import {
  createVendorProduct,
  deleteVendorProduct,
  getVendorOrders,
  getVendorProducts,
  getVendorProfile,
  updateVendorProduct,
  updateVendorProfile,
} from "../controllers/vendorController.js";
import { exportVendorPayoutsCsv, getVendorPayouts } from "../controllers/vendorPayoutController.js";
import { protect, requireRole } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(protect, requireRole("vendor"));

router.get("/profile", getVendorProfile);
router.patch("/profile", updateVendorProfile);
router.get("/products", getVendorProducts);
router.post("/products", upload.single("image"), createVendorProduct);
router.put("/products/:id", upload.single("image"), updateVendorProduct);
router.delete("/products/:id", deleteVendorProduct);
router.get("/orders", getVendorOrders);
router.get("/payouts/export.csv", exportVendorPayoutsCsv);
router.get("/payouts", getVendorPayouts);

export default router;
