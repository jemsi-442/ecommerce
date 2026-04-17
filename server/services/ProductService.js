import sequelize from "../config/db.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import ApiError from "../utils/ApiError.js";
import { serializeProduct } from "../utils/serializers.js";
import ProductReviewService from "./ProductReviewService.js";

const ALLOWED_CREATE_FIELDS = ["name", "description", "price", "stock", "image", "sku"];
const ALLOWED_UPDATE_FIELDS = ["name", "description", "price", "stock", "image", "sku"];

const normalizeImage = (input) => {
  if (!input) return undefined;

  if (typeof input === "string") return input;

  if (Array.isArray(input) && input.length === 0) return undefined;

  if (Array.isArray(input) && input.length > 0) {
    const first = input[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && first.url) return first.url;
  }

  if (typeof input === "object" && input.url) return input.url;

  throw new ApiError(400, "Invalid image payload");
};

const normalizeReviewNotes = (value, { required = false } = {}) => {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!normalized) {
    if (required) {
      throw new ApiError(400, "Review notes are required and must be at least 8 characters");
    }
    return null;
  }

  if (required && normalized.length < 8) {
    throw new ApiError(400, "Review notes are required and must be at least 8 characters");
  }

  return normalized.slice(0, 1000);
};

const pick = (src, allowedKeys) =>
  allowedKeys.reduce((acc, key) => {
    if (Object.hasOwn(src, key) && src[key] !== undefined) {
      acc[key] = src[key];
    }
    return acc;
  }, {});

const isOwner = (product, ownerId) => Number(product?.createdBy || 0) === Number(ownerId || 0);

const productIncludes = [
  {
    model: User,
    as: "creator",
    attributes: ["id", "name", "role", "storeName", "storeSlug"],
    required: false,
  },
  {
    model: User,
    as: "reviewer",
    attributes: ["id", "name", "role"],
    required: false,
  },
];

class ProductService {
  static async getProductById(productId, { includeUnapproved = false, ownerId = null } = {}) {
    const product = await Product.findByPk(productId, { include: productIncludes });
    const ownerCanView = ownerId && isOwner(product, ownerId);

    if (!product || (!includeUnapproved && !ownerCanView && product.status !== "approved")) {
      throw new ApiError(404, "Product not found");
    }

    return serializeProduct(product);
  }

  static async createProduct(input, actorId, { actorRole = "admin" } = {}) {
    const payload = pick(input, ALLOWED_CREATE_FIELDS);

    const normalizedImage = normalizeImage(input.images ?? input.image);
    if (normalizedImage !== undefined) payload.image = normalizedImage;

    if (!payload.name || payload.price == null) {
      throw new ApiError(400, "name and price are required");
    }

    const product = await Product.create({
      ...payload,
      createdBy: actorId || null,
      status: actorRole === "vendor" ? "pending" : "pending",
      approvedAt: null,
      approvedBy: null,
      reviewedAt: null,
      reviewedBy: null,
      reviewNotes: null,
    });

    const createdProduct = await Product.findByPk(product.id, { include: productIncludes });
    return serializeProduct(createdProduct);
  }

  static async listProducts({
    page = 1,
    limit = 20,
    status,
    includeUnapproved = false,
    ownerId = null,
  }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

    const where = {};

    if (ownerId) {
      where.createdBy = Number(ownerId);
      if (includeUnapproved) {
        if (status) where.status = status;
      } else {
        where.status = status || "approved";
      }
    } else if (includeUnapproved) {
      if (status) where.status = status;
    } else {
      where.status = "approved";
    }

    const order = includeUnapproved && !ownerId
      ? [
          [sequelize.literal("CASE status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END"), "ASC"],
          ["created_at", "DESC"],
        ]
      : [["created_at", "DESC"]];

    const { rows, count } = await Product.findAndCountAll({
      where,
      include: productIncludes,
      order,
      offset: (safePage - 1) * safeLimit,
      limit: safeLimit,
    });

    const reviewHighlights = await ProductReviewService.getReviewHighlightsByProductIds(
      rows.map((item) => Number(item.id))
    );

    return {
      items: rows.map((item) => {
        const serialized = serializeProduct(item);
        const summary = reviewHighlights.get(Number(item.id)) || {
          averageRating: 0,
          reviewCount: 0,
          ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        };

        return {
          ...serialized,
          ratingSummary: summary,
          averageRating: summary.averageRating,
          reviewCount: summary.reviewCount,
        };
      }),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: count,
        pages: Math.ceil(count / safeLimit) || 1,
      },
    };
  }

  static async updateProduct(productId, input, { actorId = null, actorRole = "admin" } = {}) {
    const payload = pick(input, ALLOWED_UPDATE_FIELDS);

    const normalizedImage = normalizeImage(input.images ?? input.image);
    if (normalizedImage !== undefined) payload.image = normalizedImage;

    if (Object.keys(payload).length === 0) {
      throw new ApiError(400, "No updatable fields provided");
    }

    const product = await Product.findByPk(productId, { include: productIncludes });
    if (!product) throw new ApiError(404, "Product not found");

    if (actorRole === "vendor" && !isOwner(product, actorId)) {
      throw new ApiError(403, "You can only manage products from your own store");
    }

    if (actorRole === "vendor") {
      payload.status = "pending";
      payload.approvedAt = null;
      payload.approvedBy = null;
      payload.reviewedAt = null;
      payload.reviewedBy = null;
      payload.reviewNotes = null;
    }

    await product.update(payload);

    const updatedProduct = await Product.findByPk(product.id, { include: productIncludes });
    return serializeProduct(updatedProduct);
  }

  static async deleteProduct(productId, { actorId = null, actorRole = "admin" } = {}) {
    const product = await Product.findByPk(productId, { include: productIncludes });
    if (!product) throw new ApiError(404, "Product not found");

    if (actorRole === "vendor" && !isOwner(product, actorId)) {
      throw new ApiError(403, "You can only delete products from your own store");
    }

    await product.destroy();
    return serializeProduct(product);
  }

  static async approveProduct(productId, adminId, reviewNotes = "") {
    return sequelize.transaction(async (transaction) => {
      const product = await Product.findByPk(productId, { transaction, lock: true, include: productIncludes });

      if (!product) {
        throw new ApiError(404, "Product not found");
      }

      const normalizedReviewNotes = normalizeReviewNotes(reviewNotes);
      const previousStatus = product.status;

      if (product.status === "approved") {
        return { product: serializeProduct(product), idempotent: true };
      }

      await product.update(
        {
          status: "approved",
          approvedAt: new Date(),
          approvedBy: adminId,
          reviewedAt: new Date(),
          reviewedBy: adminId,
          reviewNotes: normalizedReviewNotes,
        },
        { transaction }
      );

      await AuditLog.create(
        {
          userId: adminId,
          type: "status",
          action: "product_approved",
          message: `Product ${product.id} approved`,
          meta: {
            productId: product.id,
            previousStatus,
            status: "approved",
            reviewNotes: normalizedReviewNotes,
          },
        },
        { transaction }
      );

      const approvedProduct = await Product.findByPk(product.id, { transaction, include: productIncludes });
      return { product: serializeProduct(approvedProduct), idempotent: false };
    });
  }

  static async rejectProduct(productId, adminId, reviewNotes) {
    return sequelize.transaction(async (transaction) => {
      const product = await Product.findByPk(productId, { transaction, lock: true, include: productIncludes });

      if (!product) {
        throw new ApiError(404, "Product not found");
      }

      const normalizedReviewNotes = normalizeReviewNotes(reviewNotes, { required: true });
      const previousStatus = product.status;

      if (product.status === "rejected" && product.reviewNotes === normalizedReviewNotes) {
        return { product: serializeProduct(product), idempotent: true, updatedExisting: false };
      }

      await product.update(
        {
          status: "rejected",
          approvedAt: null,
          approvedBy: null,
          reviewedAt: new Date(),
          reviewedBy: adminId,
          reviewNotes: normalizedReviewNotes,
        },
        { transaction }
      );

      await AuditLog.create(
        {
          userId: adminId,
          type: "status",
          action: "product_rejected",
          message: `Product ${product.id} rejected`,
          meta: {
            productId: product.id,
            previousStatus,
            status: "rejected",
            reviewNotes: normalizedReviewNotes,
          },
        },
        { transaction }
      );

      const rejectedProduct = await Product.findByPk(product.id, { transaction, include: productIncludes });
      return {
        product: serializeProduct(rejectedProduct),
        idempotent: false,
        updatedExisting: previousStatus === "rejected",
      };
    });
  }
}

export default ProductService;
