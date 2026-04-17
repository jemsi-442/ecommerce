import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiCheckCircle, FiHeart, FiMinus, FiPlus, FiShoppingBag, FiStar, FiXCircle } from "react-icons/fi";
import { Link, useParams } from "react-router-dom";
import RecommendationShelf from "../components/RecommendationShelf";
import api from "../utils/axios";
import { extractList, extractOne } from "../utils/apiShape";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { useSavedProducts } from "../hooks/useSavedProducts";
import { PLACEHOLDER_IMAGE, resolveImageUrl } from "../utils/image";
import { getProductBadges, getProductNudge, getSignalToneClasses } from "../utils/productSignals";
import { getRecommendedProducts, getRecommendationReason, normalizeMarketplaceProduct } from "../utils/marketplaceRecommendations";
import { useToast } from "../hooks/useToast";

const EMPTY_RATING_SUMMARY = {
  averageRating: 0,
  reviewCount: 0,
  ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
};

function RatingStars({ value = 0, className = "h-4 w-4" }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value >= star - 0.25;

        return (
          <FiStar
            key={star}
            className={`${className} ${filled ? "fill-current text-amber-400" : "text-slate-300"}`}
          />
        );
      })}
    </div>
  );
}

export default function ProductDetails() {
  const { user } = useAuth();
  const { addToCart, cart } = useCart();
  const { id } = useParams();
  const { isSavedProduct, recordRecentlyViewed, toggleSavedProduct } = useSavedProducts();
  const toast = useToast();

  const [product, setProduct] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [qty, setQty] = useState(1);
  const [ratingSummary, setRatingSummary] = useState(EMPTY_RATING_SUMMARY);
  const [reviews, setReviews] = useState([]);
  const [reviewEligibility, setReviewEligibility] = useState({ canReview: false, hasPurchased: false, deliveredOrderId: null });
  const [userReview, setUserReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", comment: "" });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const isSignedInCustomer = Boolean(user?.token) && ["customer", "user"].includes(user?.role);

  useEffect(() => {
    let mounted = true;

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError("");

        const [{ data: productResponse }, { data: productsResponse }] = await Promise.all([
          api.get(`/products/${id}`),
          api.get('/products?status=approved'),
        ]);

        const productData = extractOne(productResponse);
        const normalizedProduct = normalizeMarketplaceProduct({
          ...productData,
          images: (productData.images || []).map((img) => resolveImageUrl(img, "")).filter(Boolean),
        });

        const normalizedCatalog = extractList(productsResponse, ['products', 'items'])
          .map((entry) => normalizeMarketplaceProduct(entry))
          .filter((entry) => String(entry._id) !== String(normalizedProduct._id));

        if (!mounted) {
          return;
        }

        setProduct(normalizedProduct);
        setCatalog(normalizedCatalog);
        setSelectedVariant(normalizedProduct.variants?.[0] || null);
        setActiveImage(0);
        setQty(1);
        setRatingSummary(productData.ratingSummary || EMPTY_RATING_SUMMARY);
        setReviews(Array.isArray(productData.reviews) ? productData.reviews : []);
        setReviewEligibility(productData.reviewEligibility || { canReview: false, hasPurchased: false, deliveredOrderId: null });
        setUserReview(productData.userReview || null);
        setReviewForm({
          rating: Number(productData.userReview?.rating || 5),
          title: productData.userReview?.title || "",
          comment: productData.userReview?.comment || "",
        });
        recordRecentlyViewed(normalizedProduct);
      } catch (err) {
        if (mounted) {
          setError('Failed to load product.');
          setProduct(null);
          setCatalog([]);
          setRatingSummary(EMPTY_RATING_SUMMARY);
          setReviews([]);
          setReviewEligibility({ canReview: false, hasPurchased: false, deliveredOrderId: null });
          setUserReview(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchProduct();

    return () => {
      mounted = false;
    };
  }, [id, recordRecentlyViewed]);

  const isSaved = useMemo(() => isSavedProduct(product?._id), [isSavedProduct, product?._id]);

  const availableStock = useMemo(() => {
    if (!product) return 0;
    if (selectedVariant) return selectedVariant.stock;
    return product.countInStock || 0;
  }, [product, selectedVariant]);

  const cartProductQuantities = useMemo(() => {
    const quantities = new Map();

    cart.forEach((item) => {
      const key = String(item.productId);
      quantities.set(key, (quantities.get(key) || 0) + Number(item.qty || 0));
    });

    return quantities;
  }, [cart]);

  const getCartQuantity = (productId) => cartProductQuantities.get(String(productId)) || 0;
  const currentCartQty = product ? getCartQuantity(product._id) : 0;

  const productBadges = useMemo(() => (product ? getProductBadges(product) : []), [product]);

  const productNudge = useMemo(() => (product ? getProductNudge(product) : ""), [product]);
  const ratingBreakdownRows = useMemo(
    () => [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: Number(ratingSummary?.ratingBreakdown?.[rating] || 0),
    })),
    [ratingSummary]
  );

  const relatedProducts = useMemo(() => {
    if (!product) {
      return [];
    }

    return getRecommendedProducts({
      catalog,
      anchors: [product],
      excludeIds: [product._id],
      limit: 4,
    });
  }, [catalog, product]);

  const moreFromStore = useMemo(() => {
    if (!product?.vendor?.storeSlug) {
      return [];
    }

    const blocked = new Set([String(product._id), ...relatedProducts.map((entry) => String(entry._id))]);

    return catalog
      .filter((entry) => entry.vendor?.storeSlug === product.vendor.storeSlug)
      .filter((entry) => !blocked.has(String(entry._id)))
      .sort((a, b) => {
        const stockGap = Number(b.countInStock || 0) - Number(a.countInStock || 0);
        if (stockGap !== 0) {
          return stockGap;
        }

        const aGap = Math.abs(Number(a.price || 0) - Number(product.price || 0));
        const bGap = Math.abs(Number(b.price || 0) - Number(product.price || 0));
        return aGap - bGap;
      })
      .slice(0, 4);
  }, [catalog, product, relatedProducts]);

  const handleToggleSaved = (targetProduct = product) => {
    if (!targetProduct) {
      return;
    }

    const added = toggleSavedProduct(targetProduct);
    toast.success(added ? 'Saved to your wishlist' : 'Removed from your wishlist');
  };

  const handleAddToCart = () => {
    addToCart({
      productId: product._id,
      name: product.name,
      price: Number(selectedVariant?.price || product.price),
      image: product.images?.[0] || product.image,
      qty,
      stock: availableStock,
      variant: selectedVariant,
    });
    toast.success('Product added to cart');
  };

  const handleRecommendationAddToCart = (recommendedProduct) => {
    const stock = Number(recommendedProduct.countInStock || 0);
    if (stock <= 0) {
      toast.error(`${recommendedProduct.name} is currently unavailable`);
      return;
    }

    addToCart({
      productId: recommendedProduct._id,
      name: recommendedProduct.name,
      price: Number(recommendedProduct.price || 0),
      image: recommendedProduct.image,
      qty: 1,
      stock,
      variant: null,
    });

    toast.success(`${recommendedProduct.name} added to cart`);
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();

    if (!product?._id) {
      return;
    }

    if (!isSignedInCustomer) {
      toast.error("Sign in as a shopper to share a review");
      return;
    }

    try {
      setReviewSubmitting(true);
      const { data } = await api.post(`/products/${product._id}/reviews`, reviewForm);
      const payload = extractOne(data) || {};

      setRatingSummary(payload.summary || EMPTY_RATING_SUMMARY);
      setReviews(Array.isArray(payload.items) ? payload.items : []);
      setReviewEligibility({
        canReview: Boolean(payload.canReview),
        hasPurchased: Boolean(payload.hasPurchased),
        deliveredOrderId: payload.deliveredOrderId || null,
      });
      setUserReview(payload.userReview || payload.review || null);
      setReviewForm({
        rating: Number((payload.userReview || payload.review)?.rating || reviewForm.rating || 5),
        title: (payload.userReview || payload.review)?.title || "",
        comment: (payload.userReview || payload.review)?.comment || "",
      });
      setProduct((current) =>
        current
          ? {
              ...current,
              averageRating: Number(payload.summary?.averageRating || 0),
              reviewCount: Number(payload.summary?.reviewCount || 0),
              ratingSummary: payload.summary || EMPTY_RATING_SUMMARY,
            }
          : current
      );
      toast.success(data?.message || (userReview ? "Your review was updated" : "Your review is live"));
    } catch (err) {
      toast.error(err.response?.data?.message || "We could not save your review");
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) return <div className="py-28 text-center text-slate-500">Loading product...</div>;

  if (error || !product) {
    return <div className="py-28 text-center text-red-500">{error || 'Product not found'}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="grid gap-7 md:gap-10 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="overflow-hidden rounded-2xl bg-slate-100"
            >
              <img
                src={product.images?.[activeImage] || product.image}
                alt={product.name}
                onError={(event) => {
                  event.currentTarget.src = PLACEHOLDER_IMAGE;
                }}
                className="aspect-square w-full object-cover"
              />
            </motion.div>

            {product.images?.length > 1 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {product.images.map((img, index) => (
                  <button
                    aria-label="View image thumbnail"
                    key={index}
                    onClick={() => setActiveImage(index)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${activeImage === index ? 'border-rose-500' : 'border-slate-200'}`}
                  >
                    <img
                      src={img}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.src = PLACEHOLDER_IMAGE;
                      }}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <h1 className="text-3xl font-black text-slate-900">{product.name}</h1>
            <p className="mt-2 text-2xl font-black text-rose-600">TZS {Number(selectedVariant?.price || product.price).toLocaleString()}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
                <RatingStars value={Number(ratingSummary.averageRating || 0)} />
                <span className="font-semibold">
                  {ratingSummary.reviewCount
                    ? `${Number(ratingSummary.averageRating || 0).toFixed(1)} from ${ratingSummary.reviewCount} shopper reviews`
                    : "No shopper ratings yet"}
                </span>
              </div>
            </div>

            <p className="mt-4 leading-relaxed text-slate-600">{product.description}</p>

            {product.vendor?.storeSlug ? (
              <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-500">Sold By</p>
                <Link
                  to={`/stores/${product.vendor.storeSlug}`}
                  className="mt-2 inline-flex items-center gap-2 text-base font-bold text-slate-900 hover:text-amber-700"
                >
                  {product.vendor.storeName || product.vendor.name}
                </Link>
              </div>
            ) : null}

            {product.variants?.length > 0 ? (
              <div className="mt-7">
                <h3 className="mb-2 font-bold text-slate-900">Variant</h3>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant) => (
                    <button
                      key={variant._id}
                      onClick={() => setSelectedVariant(variant)}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium ${selectedVariant?._id === variant._id ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-rose-300'}`}
                    >
                      {variant.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 inline-flex items-center gap-2 text-sm">
              {availableStock > 0 ? (
                <>
                  <FiCheckCircle className="text-emerald-500" />
                  <span className="text-emerald-700">{availableStock} in stock</span>
                </>
              ) : (
                <>
                  <FiXCircle className="text-red-500" />
                  <span className="text-red-600">Out of stock</span>
                </>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {currentCartQty > 0 ? (
                <span className="rounded-full bg-sky-50 px-3 py-1 font-semibold text-sky-700">
                  In cart x{currentCartQty}
                </span>
              ) : null}
              {isSaved ? (
                <span className="rounded-full bg-rose-50 px-3 py-1 font-semibold text-rose-700">
                  Saved by you
                </span>
              ) : null}
              {productBadges.map((badge) => (
                <span key={badge.label} className={`rounded-full px-3 py-1 font-semibold ${getSignalToneClasses(badge.tone)}`}>
                  {badge.label}
                </span>
              ))}
            </div>

            <p className="mt-4 text-sm font-medium text-slate-600">{productNudge}</p>

            <div className="mt-6 flex items-center gap-4">
              <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-300">
                <button aria-label="Decrease quantity" onClick={() => setQty((current) => Math.max(1, current - 1))} className="px-3 py-2 hover:bg-slate-100">
                  <FiMinus />
                </button>
                <span className="px-4 font-semibold text-slate-800">{qty}</span>
                <button aria-label="Increase quantity" onClick={() => setQty((current) => Math.min(availableStock, current + 1))} className="px-3 py-2 hover:bg-slate-100">
                  <FiPlus />
                </button>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => handleToggleSaved(product)}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition sm:w-auto ${
                  isSaved
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-rose-200 hover:text-rose-600'
                }`}
              >
                <FiHeart /> {isSaved ? 'Saved' : 'Save for later'}
              </button>

              <button
                onClick={handleAddToCart}
                disabled={availableStock === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#10b981_0%,#0f766e_100%)] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <FiShoppingBag /> {currentCartQty > 0 ? "Add another" : "Add to Cart"}
              </button>
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-500">Shopper trust</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">What buyers are saying</h2>
            <div className="mt-5 flex items-end gap-4">
              <div>
                <p className="text-4xl font-black text-slate-900">
                  {ratingSummary.reviewCount ? Number(ratingSummary.averageRating || 0).toFixed(1) : "0.0"}
                </p>
                <div className="mt-2">
                  <RatingStars value={Number(ratingSummary.averageRating || 0)} className="h-5 w-5" />
                </div>
              </div>
              <p className="pb-1 text-sm text-slate-500">
                {ratingSummary.reviewCount
                  ? `${ratingSummary.reviewCount} verified shopper review${ratingSummary.reviewCount === 1 ? "" : "s"}`
                  : "Ratings will appear here after delivered orders are reviewed."}
              </p>
            </div>

            <div className="mt-6 space-y-3">
              {ratingBreakdownRows.map((row) => {
                const share = ratingSummary.reviewCount
                  ? Math.round((row.count / ratingSummary.reviewCount) * 100)
                  : 0;

                return (
                  <div key={row.rating} className="grid grid-cols-[52px_1fr_48px] items-center gap-3 text-sm">
                    <span className="font-semibold text-slate-700">{row.rating} star</span>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b_0%,#f97316_100%)]"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <span className="text-right text-slate-500">{row.count}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Share your experience</p>
              {isSignedInCustomer ? (
                reviewEligibility.canReview ? (
                  <p className="mt-1 text-sm text-slate-600">
                    {userReview
                      ? "You can update your review any time if your experience changes."
                      : "Your delivered order qualifies for a verified shopper review."}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">
                    Buy and receive this product first, then come back to leave a verified review.
                  </p>
                )
              ) : (
                <p className="mt-1 text-sm text-slate-600">
                  Sign in as a shopper to save products, order smoothly, and share reviews after delivery.
                </p>
              )}

              {isSignedInCustomer && reviewEligibility.canReview ? (
                <form onSubmit={handleReviewSubmit} className="mt-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Your rating</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[5, 4, 3, 2, 1].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setReviewForm((current) => ({ ...current, rating }))}
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            Number(reviewForm.rating) === rating
                              ? "border-amber-300 bg-amber-50 text-amber-700"
                              : "border-slate-300 bg-white text-slate-700 hover:border-amber-200"
                          }`}
                        >
                          <FiStar className={`${Number(reviewForm.rating) === rating ? "fill-current" : ""}`} />
                          {rating}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500" htmlFor="review-title">
                      Headline
                    </label>
                    <input
                      id="review-title"
                      type="text"
                      value={reviewForm.title}
                      onChange={(event) => setReviewForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="What stood out most?"
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-300"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500" htmlFor="review-comment">
                      Review
                    </label>
                    <textarea
                      id="review-comment"
                      value={reviewForm.comment}
                      onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))}
                      placeholder="Tell other shoppers how delivery, quality, and value felt."
                      rows={4}
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-300"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#f59e0b_0%,#ea580c_100%)] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {reviewSubmitting ? "Saving review..." : userReview ? "Update your review" : "Share your review"}
                  </button>
                </form>
              ) : null}

              {!isSignedInCustomer ? (
                <Link
                  to="/login"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-700 hover:text-amber-800"
                >
                  Sign in to review after delivery
                </Link>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-500">Recent reviews</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">Verified shopper feedback</h2>
            <div className="mt-6 space-y-4">
              {reviews.length ? (
                reviews.map((review) => (
                  <article key={review._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{review.title || "Shopper review"}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <RatingStars value={Number(review.rating || 0)} />
                          <span className="text-sm text-slate-500">
                            {review.author?.name || "Verified shopper"}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-400">
                        {review.updatedAt ? new Date(review.updatedAt).toLocaleDateString() : ""}
                      </p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{review.comment}</p>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                  No shopper reviews yet. The first delivered order review will appear here.
                </div>
              )}
            </div>
          </section>
        </div>

        <RecommendationShelf
          title="Related products you may want next"
          subtitle="More marketplace picks that match this product's style, seller profile, or price range."
          products={relatedProducts}
          onAddToCart={handleRecommendationAddToCart}
          onToggleSaved={handleToggleSaved}
          isSavedProduct={isSavedProduct}
          getCartQuantity={getCartQuantity}
          getReasonLabel={(recommendedProduct) => getRecommendationReason({ product: recommendedProduct, anchors: [product] })}
          emptyMessage="More related products will appear here as the marketplace grows."
        />

        {moreFromStore.length ? (
          <RecommendationShelf
            title="More from this store"
            subtitle="Keep exploring the seller behind this item with more ready-to-shop picks from the same storefront."
            products={moreFromStore}
            onAddToCart={handleRecommendationAddToCart}
            onToggleSaved={handleToggleSaved}
            isSavedProduct={isSavedProduct}
            getCartQuantity={getCartQuantity}
            getReasonLabel={() => "From the same store as the item you are viewing"}
            emptyMessage="More products from this store will appear here as the seller catalog grows."
          />
        ) : null}
      </div>
    </div>
  );
}
