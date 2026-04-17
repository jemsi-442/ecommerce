import { Op } from "sequelize";
import sequelize from "../config/db.js";
import ApiError from "../utils/ApiError.js";
import { Order, OrderItem, Product, ProductReview, User } from "../models/index.js";

const reviewIncludes = [
  {
    model: User,
    as: "author",
    attributes: ["id", "name"],
    required: false,
  },
];

const normalizeRating = (value) => {
  const rating = Number.parseInt(value, 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError(400, "Rating must be a whole number between 1 and 5");
  }

  return rating;
};

const normalizeTitle = (value) => {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!normalized) {
    return null;
  }

  if (normalized.length < 3) {
    throw new ApiError(400, "Review title must be at least 3 characters");
  }

  return normalized.slice(0, 120);
};

const normalizeComment = (value) => {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ");

  if (normalized.length < 12) {
    throw new ApiError(400, "Review comment must be at least 12 characters");
  }

  return normalized.slice(0, 1500);
};

const serializeReview = (row) => ({
  _id: row.id,
  id: row.id,
  rating: Number(row.rating || 0),
  title: row.title || null,
  comment: row.comment || "",
  createdAt: row.createdAt || row.created_at || null,
  updatedAt: row.updatedAt || row.updated_at || null,
  orderId: row.orderId || row.order_id || null,
  author: row.author
    ? {
        _id: row.author.id,
        id: row.author.id,
        name: row.author.name,
      }
    : null,
});

const emptySummary = () => ({
  averageRating: 0,
  reviewCount: 0,
  ratingBreakdown: {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  },
});

const buildSummary = (reviews) => {
  const summary = emptySummary();

  if (!reviews.length) {
    return summary;
  }

  let total = 0;

  reviews.forEach((review) => {
    const rating = Number(review.rating || 0);
    if (rating >= 1 && rating <= 5) {
      summary.ratingBreakdown[rating] += 1;
      total += rating;
      summary.reviewCount += 1;
    }
  });

  summary.averageRating = summary.reviewCount
    ? Number((total / summary.reviewCount).toFixed(1))
    : 0;

  return summary;
};

const buildStoreSummary = (reviews) => {
  const summary = buildSummary(reviews);
  return {
    ...summary,
    averageRatingLabel: summary.reviewCount
      ? `${summary.averageRating.toFixed(1)} / 5`
      : "No ratings yet",
  };
};

const findEligibleDeliveredOrder = async (productId, userId, { transaction } = {}) => {
  return OrderItem.findOne({
    where: {
      productId: Number(productId),
    },
    include: [
      {
        model: Order,
        as: "order",
        attributes: ["id", "userId", "status", "deliveredAt"],
        where: {
          userId: Number(userId),
          status: "delivered",
        },
        required: true,
      },
    ],
    transaction,
  });
};

class ProductReviewService {
  static async getProductReviewBundle(productId, { userId = null, transaction = null } = {}) {
    const product = await Product.findByPk(productId, {
      attributes: ["id", "createdBy", "status"],
      transaction,
    });

    if (!product || product.status !== "approved") {
      throw new ApiError(404, "Product not found");
    }

    const reviews = await ProductReview.findAll({
      where: { productId: Number(productId) },
      include: reviewIncludes,
      order: [
        ["updated_at", "DESC"],
        ["created_at", "DESC"],
      ],
      transaction,
    });

    const summary = buildSummary(reviews);
    let userReview = null;
    let canReview = false;
    let deliveredOrderId = null;

    if (userId) {
      const existingReview = reviews.find((review) => Number(review.userId) === Number(userId));
      if (existingReview) {
        userReview = serializeReview(existingReview);
      }

      const deliveredOrder = await findEligibleDeliveredOrder(productId, userId, { transaction });
      if (deliveredOrder?.order) {
        canReview = true;
        deliveredOrderId = deliveredOrder.order.id;
      }
    }

    return {
      summary,
      items: reviews.map((review) => serializeReview(review)),
      canReview,
      hasPurchased: canReview,
      deliveredOrderId,
      userReview,
    };
  }

  static async upsertProductReview(productId, userId, input) {
    const rating = normalizeRating(input?.rating);
    const title = normalizeTitle(input?.title);
    const comment = normalizeComment(input?.comment);

    return sequelize.transaction(async (transaction) => {
      const product = await Product.findByPk(productId, {
        transaction,
        lock: true,
        attributes: ["id", "status"],
      });

      if (!product || product.status !== "approved") {
        throw new ApiError(404, "Product not found");
      }

      const eligibleOrderItem = await findEligibleDeliveredOrder(productId, userId, { transaction });
      if (!eligibleOrderItem?.order) {
        throw new ApiError(403, "You can review this product after a delivered order");
      }

      const existingReview = await ProductReview.findOne({
        where: {
          productId: Number(productId),
          userId: Number(userId),
        },
        transaction,
        lock: true,
      });

      const payload = {
        orderId: eligibleOrderItem.order.id,
        rating,
        title,
        comment,
      };

      let review;
      let created = false;

      if (existingReview) {
        await existingReview.update(payload, { transaction });
        review = existingReview;
      } else {
        review = await ProductReview.create(
          {
            productId: Number(productId),
            userId: Number(userId),
            ...payload,
          },
          { transaction }
        );
        created = true;
      }

      const storedReview = await ProductReview.findByPk(review.id, {
        transaction,
        include: reviewIncludes,
      });

      const bundle = await ProductReviewService.getProductReviewBundle(productId, {
        userId,
        transaction,
      });

      return {
        created,
        review: serializeReview(storedReview),
        ...bundle,
      };
    });
  }

  static async attachReviewSummaryToProduct(product, { userId = null, transaction = null } = {}) {
    const reviewBundle = await ProductReviewService.getProductReviewBundle(product.id || product._id, {
      userId,
      transaction,
    });

    return {
      ...product,
      ratingSummary: reviewBundle.summary,
      averageRating: reviewBundle.summary.averageRating,
      reviewCount: reviewBundle.summary.reviewCount,
      reviews: reviewBundle.items,
      reviewEligibility: {
        canReview: reviewBundle.canReview,
        hasPurchased: reviewBundle.hasPurchased,
        deliveredOrderId: reviewBundle.deliveredOrderId,
      },
      userReview: reviewBundle.userReview,
    };
  }

  static async getStoreReviewSummary(storeId) {
    const reviews = await ProductReview.findAll({
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "createdBy", "name"],
          required: true,
          where: {
            createdBy: Number(storeId),
            status: "approved",
          },
        },
        ...reviewIncludes,
      ],
      order: [
        ["updated_at", "DESC"],
        ["created_at", "DESC"],
      ],
    });

    const summary = buildStoreSummary(reviews);
    return {
      ...summary,
      recentReviews: reviews.slice(0, 3).map((review) => ({
        ...serializeReview(review),
        productName: review.product?.name || null,
      })),
    };
  }

  static async getReviewHighlightsByProductIds(productIds) {
    const safeIds = [...new Set((productIds || []).map((entry) => Number(entry)).filter((entry) => entry > 0))];

    if (!safeIds.length) {
      return new Map();
    }

    const reviews = await ProductReview.findAll({
      where: {
        productId: {
          [Op.in]: safeIds,
        },
      },
      attributes: ["productId", "rating"],
      raw: true,
    });

    const grouped = new Map();

    safeIds.forEach((productId) => {
      grouped.set(productId, emptySummary());
    });

    reviews.forEach((review) => {
      const productId = Number(review.productId);
      const current = grouped.get(productId) || emptySummary();
      const rating = Number(review.rating || 0);

      if (rating >= 1 && rating <= 5) {
        current.ratingBreakdown[rating] += 1;
        current.reviewCount += 1;
        current.averageRating += rating;
        grouped.set(productId, current);
      }
    });

    grouped.forEach((summary, productId) => {
      summary.averageRating = summary.reviewCount
        ? Number((summary.averageRating / summary.reviewCount).toFixed(1))
        : 0;
      grouped.set(productId, summary);
    });

    return grouped;
  }
}

export default ProductReviewService;
