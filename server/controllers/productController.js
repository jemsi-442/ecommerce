import asyncHandler from "../middleware/asyncHandler.js";
import ProductService from "../services/ProductService.js";
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
  const product = await ProductService.getProductById(req.params.id);
  return sendResponse(res, 200, "Product fetched", product);
});

export const getProducts = asyncHandler(async (req, res) => {
  const data = await ProductService.listProducts({
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
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
  const result = await ProductService.approveProduct(req.params.id, req.user._id);

  return sendResponse(
    res,
    200,
    result.idempotent ? "Product already approved" : "Product approved",
    result.product
  );
});
