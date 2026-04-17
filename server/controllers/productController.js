import asyncHandler from "../middleware/asyncHandler.js";
import ProductService from "../services/ProductService.js";
import ProductReviewService from "../services/ProductReviewService.js";
import { sendResponse } from "../utils/apiResponse.js";
import { uploadProductImage } from "../middleware/uploadMiddleware.js";

export const createProduct = asyncHandler(async (req, res) => {
  const payload = { ...req.body };

  if (req.file?.buffer) {
    const image = await uploadProductImage(req.file.buffer, req.file.originalname);
    payload.images = [...(payload.images || []), image];
  }

  const product = await ProductService.createProduct(payload, req.user?._id);
  return sendResponse(res, 201, "Product created", product);
});

export const getProductById = asyncHandler(async (req, res) => {
  const product = await ProductService.getProductById(req.params.id, {
    includeUnapproved: req.user?.role === "admin",
    ownerId: req.user?._id || null,
  });
  const productWithReviews = product.status === "approved"
    ? await ProductReviewService.attachReviewSummaryToProduct(product, {
        userId: ["customer", "user"].includes(req.user?.role) ? req.user?._id : null,
      })
    : {
        ...product,
        ratingSummary: {
          averageRating: 0,
          reviewCount: 0,
          ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        },
        averageRating: 0,
        reviewCount: 0,
        reviews: [],
        reviewEligibility: {
          canReview: false,
          hasPurchased: false,
          deliveredOrderId: null,
        },
        userReview: null,
      };
  return sendResponse(res, 200, "Product fetched", productWithReviews);
});

export const getProducts = asyncHandler(async (req, res) => {
  const data = await ProductService.listProducts({
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
    includeUnapproved: req.user?.role === "admin",
  });

  return sendResponse(res, 200, "Products fetched", data);
});

export const updateProduct = asyncHandler(async (req, res) => {
  const payload = { ...req.body };

  if (req.file?.buffer) {
    const image = await uploadProductImage(req.file.buffer, req.file.originalname);
    payload.images = [...(payload.images || []), image];
  }

  const product = await ProductService.updateProduct(req.params.id, payload);
  return sendResponse(res, 200, "Product updated", product);
});

export const deleteProduct = asyncHandler(async (req, res) => {
  await ProductService.deleteProduct(req.params.id);
  return sendResponse(res, 200, "Product deleted", null);
});

export const approveProduct = asyncHandler(async (req, res) => {
  const result = await ProductService.approveProduct(
    req.params.id,
    req.user._id,
    req.body?.reviewNotes ?? req.body?.notes ?? ""
  );

  return sendResponse(
    res,
    200,
    result.idempotent ? "Product already approved" : "Product approved",
    result.product
  );
});

export const rejectProduct = asyncHandler(async (req, res) => {
  const result = await ProductService.rejectProduct(
    req.params.id,
    req.user._id,
    req.body?.reviewNotes ?? req.body?.notes ?? ""
  );

  return sendResponse(
    res,
    200,
    result.idempotent
      ? "Product already rejected"
      : result.updatedExisting
        ? "Product feedback updated"
        : "Product sent back with feedback",
    result.product
  );
});

export const getProductReviews = asyncHandler(async (req, res) => {
  const data = await ProductReviewService.getProductReviewBundle(req.params.id, {
    userId: ["customer", "user"].includes(req.user?.role) ? req.user?._id : null,
  });

  return sendResponse(res, 200, "Product reviews fetched", data);
});

export const upsertProductReview = asyncHandler(async (req, res) => {
  const result = await ProductReviewService.upsertProductReview(req.params.id, req.user._id, {
    rating: req.body?.rating,
    title: req.body?.title,
    comment: req.body?.comment,
  });

  return sendResponse(
    res,
    result.created ? 201 : 200,
    result.created ? "Review shared" : "Review updated",
    result
  );
});
