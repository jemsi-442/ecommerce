import sequelize from "../config/db.js";
import Product from "../models/Product.js";
import AuditLog from "../models/AuditLog.js";
import ApiError from "../utils/ApiError.js";
import { serializeProduct } from "../utils/serializers.js";

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

const pick = (src, allowedKeys) =>
  allowedKeys.reduce((acc, key) => {
    if (Object.hasOwn(src, key) && src[key] !== undefined) {
      acc[key] = src[key];
    }
    return acc;
  }, {});

class ProductService {
  static async getProductById(productId) {
    const product = await Product.findByPk(productId);
    if (!product) throw new ApiError(404, "Product not found");
    return serializeProduct(product);
  }

  static async createProduct(input, actorId) {
    const payload = pick(input, ALLOWED_CREATE_FIELDS);

    const normalizedImage = normalizeImage(input.images ?? input.image);
    if (normalizedImage !== undefined) payload.image = normalizedImage;

    if (!payload.name || payload.price == null) {
      throw new ApiError(400, "name and price are required");
    }

    const product = await Product.create({
      ...payload,
      createdBy: actorId || null,
      status: "pending",
    });

    return serializeProduct(product);
  }

  static async listProducts({ page = 1, limit = 20, status }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

    const where = {};
    if (status) where.status = status;

    const { rows, count } = await Product.findAndCountAll({
      where,
      order: [["created_at", "DESC"]],
      offset: (safePage - 1) * safeLimit,
      limit: safeLimit,
    });

    return {
      items: rows.map((item) => serializeProduct(item)),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: count,
        pages: Math.ceil(count / safeLimit) || 1,
      },
    };
  }

  static async updateProduct(productId, input) {
    const payload = pick(input, ALLOWED_UPDATE_FIELDS);

    const normalizedImage = normalizeImage(input.images ?? input.image);
    if (normalizedImage !== undefined) payload.image = normalizedImage;

    if (Object.keys(payload).length === 0) {
      throw new ApiError(400, "No updatable fields provided");
    }

    const product = await Product.findByPk(productId);
    if (!product) throw new ApiError(404, "Product not found");

    await product.update(payload);

    return serializeProduct(product);
  }

  static async deleteProduct(productId) {
    const product = await Product.findByPk(productId);
    if (!product) throw new ApiError(404, "Product not found");

    await product.destroy();
    return serializeProduct(product);
  }

  static async approveProduct(productId, adminId) {
    return sequelize.transaction(async (transaction) => {
      const product = await Product.findByPk(productId, { transaction, lock: true });

      if (!product) {
        throw new ApiError(404, "Product not found");
      }

      if (product.status === "approved") {
        return { product: serializeProduct(product), idempotent: true };
      }

      if (product.status !== "pending") {
        throw new ApiError(409, "Unable to approve product due to conflicting state");
      }

      await product.update(
        {
          status: "approved",
          approvedAt: new Date(),
          approvedBy: adminId,
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
            status: product.status,
          },
        },
        { transaction }
      );

      return { product: serializeProduct(product), idempotent: false };
    });
  }
}

export default ProductService;
