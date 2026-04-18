import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowRight, FiHeart, FiHome, FiPackage, FiPhone, FiShoppingBag, FiStar } from "react-icons/fi";
import PageState from "../components/PageState";
import api from "../utils/axios";
import { extractList, extractOne } from "../utils/apiShape";
import { useCart } from "../hooks/useCart";
import { useSavedProducts } from "../hooks/useSavedProducts";
import { useToast } from "../hooks/useToast";
import { PLACEHOLDER_IMAGE, resolveImageUrl } from "../utils/image";
import { getProductBadges, getProductNudge, getSignalToneClasses } from "../utils/productSignals";
import { getStoreBadges, getStoreNudge, getStoreSignalToneClasses } from "../utils/storeSignals";

const formatCurrency = (value) => `TZS ${Number(value || 0).toLocaleString()}`;

function StatChip({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-50/70">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function RatingStars({ value = 0 }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <FiStar
          key={star}
          className={`h-4 w-4 ${value >= star - 0.25 ? "fill-current text-amber-300" : "text-white/30"}`}
        />
      ))}
    </div>
  );
}

export default function Storefront() {
  const { slug } = useParams();
  const { addToCart, cart } = useCart();
  const { isFavoriteStore, isSavedProduct, toggleFavoriteStore, toggleSavedProduct } = useSavedProducts();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [recentReviews, setRecentReviews] = useState([]);

  useEffect(() => {
    const loadStore = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/stores/${slug}`);
        const payload = extractOne(data) || {};
        const items = extractList(data, ["products", "items"]).map((product) => ({
          ...product,
          image: resolveImageUrl(
            [product.imageUrl, product.image, ...(product.images || [])],
            PLACEHOLDER_IMAGE
          ),
          countInStock:
            typeof product.countInStock === "number"
              ? product.countInStock
              : typeof product.stock === "number"
                ? product.stock
                : 0,
        }));

        setStore(payload.store || null);
        setProducts(items);
        setRecentReviews(Array.isArray(payload.recentReviews) ? payload.recentReviews : []);
        setError("");
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load store.");
        setStore(null);
        setProducts([]);
        setRecentReviews([]);
      } finally {
        setLoading(false);
      }
    };

    loadStore();
  }, [slug]);

  const cartProductQuantities = useMemo(() => {
    const quantities = new Map();

    cart.forEach((item) => {
      const key = String(item.productId);
      quantities.set(key, (quantities.get(key) || 0) + Number(item.qty || 0));
    });

    return quantities;
  }, [cart]);

  const getCartQuantity = (productId) => cartProductQuantities.get(String(productId)) || 0;

  const storeStats = useMemo(() => {
    const readyNow = products.filter((product) => Number(product.countInStock || 0) > 0).length;
    const valuePicks = products.filter((product) => Number(product.price || 0) > 0 && Number(product.price || 0) <= 50000).length;
    const startingPrice = products.length ? Math.min(...products.map((product) => Number(product.price || 0)).filter((price) => price > 0)) : 0;

    return {
      liveItems: products.length,
      readyNow,
      valuePicks,
      startingPrice,
    };
  }, [products]);

  const storeBadges = useMemo(
    () =>
      getStoreBadges({
        ...store,
        liveItems: storeStats.liveItems,
        readyNowCount: storeStats.readyNow,
        startingPrice: storeStats.startingPrice,
      }),
    [store, storeStats]
  );

  const handleToggleSaved = (product) => {
    const added = toggleSavedProduct(product);
    toast.success(added ? `${product.name} saved for later` : `${product.name} removed from saved items`);
  };


  const handleToggleFavoriteStore = () => {
    const added = toggleFavoriteStore({
      ...store,
      sampleImage: products[0]?.image || store?.sampleImage,
      itemCount: storeStats.liveItems,
      inStockCount: storeStats.readyNow,
      startingPrice: storeStats.startingPrice,
    });
    toast.success(added ? `${store.storeName || store.name} saved to favorite stores` : `${store.storeName || store.name} removed from favorite stores`);
  };

  const handleAddToCart = (product) => {
    const stock = Number(product.countInStock || 0);
    if (stock <= 0) {
      toast.error(`${product.name} is currently unavailable`);
      return;
    }

    addToCart({
      productId: product._id,
      name: product.name,
      price: Number(product.price || 0),
      image: product.image,
      qty: 1,
      stock,
      variant: null,
    });

    toast.success(`${product.name} added to cart`);
  };

  if (loading) {
    return <PageState title="Loading store" description="Preparing this seller storefront..." />;
  }

  if (error || !store) {
    return <PageState tone="error" title="Store unavailable" description={error || "Store not found."} />;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#fff7ed_52%,#ffffff_100%)]">
      <section className="relative overflow-hidden bg-[linear-gradient(130deg,#0f172a_0%,#14532d_40%,#9a3412_100%)] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.22),transparent_34%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-200/10 px-4 py-1 text-xs uppercase tracking-[0.2em] text-amber-100">
                <FiHome /> Seller storefront
              </span>
              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">{store.storeName || store.name}</h1>
              <p className="mt-4 max-w-2xl text-base text-amber-50/90 md:text-lg">
                {store.businessDescription || "Browse approved products from this seller and keep your shopping flow in one clean storefront."}
              </p>
              {storeBadges.length ? (
                <div className="mt-5 flex flex-wrap gap-2 text-xs">
                  {storeBadges.map((badge) => (
                    <span
                      key={badge.label}
                      className={`rounded-full px-3 py-1 font-semibold ${getStoreSignalToneClasses(badge.tone)}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-amber-50/85">
                <span className="rounded-full bg-white/10 px-4 py-2">Storefront: /{store.storeSlug}</span>
                {store.businessPhone ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
                    <FiPhone /> {store.businessPhone}
                  </span>
                ) : null}
                {storeStats.startingPrice > 0 ? (
                  <span className="rounded-full bg-white/10 px-4 py-2">Starts from {formatCurrency(storeStats.startingPrice)}</span>
                ) : null}
                {isFavoriteStore(store.storeSlug) ? (
                  <span className="rounded-full bg-orange-200/20 px-4 py-2 text-orange-50">Saved in your favorite stores</span>
                ) : null}
                {Number(store.reviewCount || 0) > 0 ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
                    <RatingStars value={Number(store.averageRating || 0)} />
                    {Number(store.averageRating || 0).toFixed(1)} from {store.reviewCount} reviews
                  </span>
                ) : (
                  <span className="rounded-full bg-white/10 px-4 py-2">Waiting for first shopper reviews</span>
                )}
              </div>
              <p className="mt-4 text-sm font-medium text-amber-50/80">
                {getStoreNudge({
                  ...store,
                  liveItems: storeStats.liveItems,
                  readyNowCount: storeStats.readyNow,
                  startingPrice: storeStats.startingPrice,
                })}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleToggleFavoriteStore}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${
                    isFavoriteStore(store.storeSlug)
                      ? "border border-orange-200/40 bg-orange-200/15 text-orange-50 hover:bg-orange-200/20"
                      : "border border-white/20 bg-white/10 text-white hover:bg-white/15"
                  }`}
                >
                  <FiHeart /> {isFavoriteStore(store.storeSlug) ? "Saved store" : "Save store"}
                </button>
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Keep browsing <FiArrowRight />
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatChip label="Live items" value={storeStats.liveItems} />
              <StatChip label="Ready now" value={storeStats.readyNow} />
              <StatChip
                label={Number(store.reviewCount || 0) > 0 ? "Store rating" : "Value picks"}
                value={Number(store.reviewCount || 0) > 0 ? `${Number(store.averageRating || 0).toFixed(1)} / 5` : storeStats.valuePicks}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">Store catalog</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">Everything shoppers can buy from this seller today</h2>
            <p className="mt-2 max-w-2xl text-slate-600">Explore the full seller shelf, save stronger picks, and add ready items straight into your cart without leaving the storefront.</p>
          </div>
          <Link to="/shop" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Back to marketplace <FiArrowRight />
          </Link>
        </div>

        {!products.length ? (
          <div className="mt-8">
            <PageState
              tone="warning"
              title="No approved products yet"
              description="This store is live, but the catalog will appear after admin approval."
            />
          </div>
        ) : null}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => {
            const saved = isSavedProduct(product._id);
            const cartQty = getCartQuantity(product._id);
            const badges = getProductBadges(product, { index });
            const nudge = getProductNudge(product, { index });

            return (
              <motion.article
                key={product._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <div className="relative">
                  <img
                    src={product.image}
                    alt={product.name}
                    onError={(event) => {
                      event.currentTarget.src = PLACEHOLDER_IMAGE;
                    }}
                    className="aspect-[4/4.8] w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-x-4 top-4 flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-full px-3 py-1 font-semibold ${Number(product.countInStock || 0) > 0 ? "bg-white/90 text-[#102A43]" : "bg-slate-900/75 text-white"}`}>
                      {Number(product.countInStock || 0) > 0 ? `${Number(product.countInStock || 0)} ready now` : "Currently unavailable"}
                    </span>
                    {cartQty > 0 ? (
                      <span className="rounded-full bg-slate-100/95 px-3 py-1 font-semibold text-[#102A43]">In cart x{cartQty}</span>
                    ) : null}
                    {saved ? (
                      <span className="rounded-full bg-orange-50/95 px-3 py-1 font-semibold text-orange-700">Saved by you</span>
                    ) : null}
                    {badges.slice(0, 2).map((badge) => (
                      <span key={badge.label} className={`rounded-full px-3 py-1 font-semibold ${getSignalToneClasses(badge.tone)}`}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">From this seller</p>
                      <h3 className="mt-2 text-lg font-black text-slate-900">{product.name}</h3>
                    </div>
                    <p className="text-lg font-black text-[#102A43]">{formatCurrency(product.price)}</p>
                  </div>

                  {badges.length > 2 ? (
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      {badges.slice(2, 4).map((badge) => (
                        <span key={badge.label} className={`rounded-full px-3 py-1 font-semibold ${getSignalToneClasses(badge.tone)}`}>
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Why this stands out</p>
                    <p className="mt-1 text-sm font-medium text-slate-700">{nudge}</p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      to={`/product/${product._id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <FiPackage /> View product
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleToggleSaved(product)}
                      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                        saved
                          ? "border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <FiHeart /> {saved ? "Saved" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddToCart(product)}
                      disabled={Number(product.countInStock || 0) <= 0}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#102A43_0%,#081B2E_100%)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FiShoppingBag /> {cartQty > 0 ? "Add another" : "Add to cart"}
                    </button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>

        {recentReviews.length ? (
          <section className="mt-10 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] md:p-7">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">Shopper feedback</p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">Recent reviews for this store</h3>
                <p className="mt-2 max-w-2xl text-slate-600">See how recent buyers describe delivery, value, and product quality from this seller.</p>
              </div>
              <div className="inline-flex items-center gap-3 rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                <RatingStars value={Number(store.averageRating || 0)} />
                {Number(store.averageRating || 0).toFixed(1)} average
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {recentReviews.map((review) => (
                <article key={review._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{review.title || review.productName || "Shopper review"}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                        {review.productName || "Marketplace order"}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                      {review.rating}/5
                    </span>
                  </div>
                  <div className="mt-3">
                    <RatingStars value={Number(review.rating || 0)} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{review.comment}</p>
                  <p className="mt-4 text-xs text-slate-400">
                    {review.author?.name || "Verified shopper"}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
