import express from "express";
import User from "../models/User.js";
import ProductService from "../services/ProductService.js";
import ProductReviewService from "../services/ProductReviewService.js";
import { sendResponse } from "../utils/apiResponse.js";
import { serializeUser } from "../utils/serializers.js";

const router = express.Router();

router.get("/:slug", async (req, res) => {
  try {
    const store = await User.findOne({
      where: {
        role: "vendor",
        storeSlug: String(req.params.slug || "").trim().toLowerCase(),
        active: true,
      },
    });

    if (!store) {
      return sendResponse(res, 404, "Store not found", null);
    }

    const products = await ProductService.listProducts({
      ownerId: store.id,
      page: req.query.page,
      limit: req.query.limit,
      status: "approved",
      includeUnapproved: false,
    });
    const reviewSummary = await ProductReviewService.getStoreReviewSummary(store.id);

    return sendResponse(res, 200, "Store fetched", {
      store: {
        ...serializeUser(store),
        ratingSummary: reviewSummary,
        averageRating: reviewSummary.averageRating,
        reviewCount: reviewSummary.reviewCount,
      },
      ...products,
      recentReviews: reviewSummary.recentReviews,
    });
  } catch (error) {
    return sendResponse(res, 500, error.message || "Failed to fetch store", null);
  }
});

export default router;
