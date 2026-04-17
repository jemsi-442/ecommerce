import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowRight, FiBox, FiHeart, FiPackage, FiShield, FiShoppingBag, FiStar, FiTruck } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { useSavedProducts } from "../hooks/useSavedProducts";
import MarketplaceRating from "../components/MarketplaceRating";
import RecommendationShelf from "../components/RecommendationShelf";
import api from "../utils/axios";
import { extractList } from "../utils/apiShape";
import { PLACEHOLDER_IMAGE, resolveImageUrl } from "../utils/image";
import { getRecommendedProducts, getRecommendationReason } from "../utils/marketplaceRecommendations";
import { getProductBadges, getProductNudge, getSignalToneClasses } from "../utils/productSignals";
import { getStoreBadges, getStoreNudge, getStoreSignalToneClasses } from "../utils/storeSignals";
import { useToast } from "../hooks/useToast";

const trustPoints = [
  {
    icon: FiShield,
    title: "Trusted sellers",
    desc: "Every store on the marketplace goes through review before products go live.",
  },
  {
    icon: FiTruck,
    title: "Smooth delivery",
    desc: "Orders, payments, and rider handoff stay clear from checkout to doorstep.",
  },
  {
    icon: FiStar,
    title: "Better picks",
    desc: "Shoppers see stronger products first, while sellers get space to build a brand.",
  },
];

const quickCollections = [
  {
    title: "Fresh arrivals",
    subtitle: "Recently added pieces shoppers are starting to notice.",
    search: "new",
    color: "from-emerald-500 via-emerald-400 to-teal-300",
  },
  {
    title: "Best value",
    subtitle: "Easy picks for customers who want strong value at a good price.",
    price: "0-50000",
    color: "from-amber-400 via-orange-400 to-rose-300",
  },
  {
    title: "Statement picks",
    subtitle: "Premium products that deserve the front row of the marketplace.",
    price: "100000-10000000",
    color: "from-sky-500 via-indigo-500 to-violet-400",
  },
];

export default function Home() {
  const { user } = useAuth();
  const { addToCart, cart } = useCart();
  const {
    favoriteStores,
    favoriteStoreCount,
    isFavoriteStore,
    isSavedProduct,
    recentProducts,
    savedProducts,
    toggleFavoriteStore,
    toggleSavedProduct,
  } = useSavedProducts();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const safeCart = Array.isArray(cart) ? cart : [];
  const safeFavoriteStores = Array.isArray(favoriteStores) ? favoriteStores : [];
  const safeRecentProducts = Array.isArray(recentProducts) ? recentProducts : [];
  const safeSavedProducts = Array.isArray(savedProducts) ? savedProducts : [];

  useEffect(() => {
    let mounted = true;

    const fetchProducts = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/products?status=approved');
        const rawProducts = extractList(data, ['products', 'items']);
        const normalized = rawProducts.map((product) => ({
          ...product,
          image: resolveImageUrl([product.imageUrl, product.image, ...(product.images || [])], PLACEHOLDER_IMAGE),
          countInStock:
            typeof product.countInStock === 'number'
              ? product.countInStock
              : typeof product.stock === 'number'
                ? product.stock
                : 0,
        }));

        if (mounted) {
          setProducts(normalized);
        }
      } catch (error) {
        if (mounted) {
          setProducts([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchProducts();
    return () => {
      mounted = false;
    };
  }, []);

  const featuredProducts = useMemo(() => products.slice(0, 4), [products]);

  const cartProductQuantities = useMemo(() => {
    const quantities = new Map();

    safeCart.forEach((item) => {
      const key = String(item.productId);
      quantities.set(key, (quantities.get(key) || 0) + Number(item.qty || 0));
    });

    return quantities;
  }, [safeCart]);

  const getCartQuantity = (productId) => cartProductQuantities.get(String(productId)) || 0;

  const marketplaceStats = useMemo(() => {
    const uniqueStores = new Map();
    let inStock = 0;

    products.forEach((product) => {
      if (product.vendor?.storeSlug) {
        uniqueStores.set(product.vendor.storeSlug, product.vendor);
      }
      if ((product.countInStock || 0) > 0) {
        inStock += 1;
      }
    });

    return {
      products: products.length,
      stores: uniqueStores.size,
      readyToShip: inStock,
    };
  }, [products]);

  const featuredStores = useMemo(() => {
    const storeMap = new Map();

    products.forEach((product) => {
      const vendor = product.vendor;
      if (!vendor?.storeSlug) {
        return;
      }

      const key = vendor.storeSlug;
      const current = storeMap.get(key) || {
        name: vendor.storeName || vendor.name || vendor.storeSlug,
        slug: vendor.storeSlug,
        itemCount: 0,
        inStockCount: 0,
        sampleImage: product.image,
        ratingValue: 0,
        ratedItems: 0,
        reviewCount: 0,
      };

      current.itemCount += 1;
      if ((product.countInStock || 0) > 0) {
        current.inStockCount += 1;
      }
      if (!current.sampleImage) {
        current.sampleImage = product.image;
      }
      if (Number(product.reviewCount || 0) > 0) {
        current.ratingValue += Number(product.averageRating || 0) * Number(product.reviewCount || 0);
        current.reviewCount += Number(product.reviewCount || 0);
        current.ratedItems += 1;
      }

      storeMap.set(key, current);
    });

    return Array.from(storeMap.values())
      .map((store) => ({
        ...store,
        averageRating: store.reviewCount ? Number((store.ratingValue / store.reviewCount).toFixed(1)) : 0,
      }))
      .slice(0, 3);
  }, [products]);


  const favoriteStoreCards = useMemo(() => {
    if (!safeFavoriteStores.length) {
      return [];
    }

    const storeMap = new Map();

    products.forEach((product) => {
      const vendor = product.vendor;
      if (!vendor?.storeSlug) {
        return;
      }

      const key = vendor.storeSlug;
      const current = storeMap.get(key) || {
        name: vendor.storeName || vendor.name || vendor.storeSlug,
        slug: vendor.storeSlug,
        itemCount: 0,
        inStockCount: 0,
        sampleImage: product.image,
        startingPrice: 0,
      };

      current.itemCount += 1;
      if ((product.countInStock || 0) > 0) {
        current.inStockCount += 1;
      }
      if (!current.sampleImage) {
        current.sampleImage = product.image;
      }
      if (Number(product.price || 0) > 0) {
        current.startingPrice = current.startingPrice > 0 ? Math.min(current.startingPrice, Number(product.price || 0)) : Number(product.price || 0);
      }

      storeMap.set(key, current);
    });

    return safeFavoriteStores.map((store) => ({
      ...store,
      ...(storeMap.get(store.slug) || {}),
      name: (storeMap.get(store.slug) || {}).name || store.name,
      sampleImage: (storeMap.get(store.slug) || {}).sampleImage || store.sampleImage,
    }));
  }, [products, safeFavoriteStores]);


  const isSignedInShopper = user?.role === "customer" || user?.role === "user";

  const personalizedAnchors = useMemo(
    () => [...safeSavedProducts.slice(0, 4), ...safeRecentProducts.slice(0, 4)],
    [safeRecentProducts, safeSavedProducts]
  );

  const personalizedProducts = useMemo(() => {
    if (!isSignedInShopper) {
      return [];
    }

    if (!personalizedAnchors.length) {
      return [];
    }

    return getRecommendedProducts({
      catalog: products,
      anchors: personalizedAnchors,
      excludeIds: personalizedAnchors.map((item) => item._id),
      limit: 4,
    });
  }, [isSignedInShopper, personalizedAnchors, products]);

  const familiarStoreProducts = useMemo(() => {
    if (!isSignedInShopper) {
      return [];
    }

    const preferredStoreSlugs = Array.from(
      new Set(
        [...safeSavedProducts, ...safeRecentProducts]
          .map((item) => item.vendor?.storeSlug)
          .concat(safeFavoriteStores.map((store) => store.slug))
          .filter(Boolean)
      )
    );

    if (!preferredStoreSlugs.length) {
      return [];
    }

    const excluded = new Set(personalizedProducts.map((item) => String(item._id)));
    return products
      .filter((product) => preferredStoreSlugs.includes(product.vendor?.storeSlug))
      .filter((product) => !excluded.has(String(product._id)))
      .slice(0, 4);
  }, [
    isSignedInShopper,
    personalizedProducts,
    products,
    safeFavoriteStores,
    safeRecentProducts,
    safeSavedProducts,
  ]);

  const topRatedProducts = useMemo(() => {
    return products
      .filter((product) => Number(product.reviewCount || 0) > 0)
      .sort((a, b) => {
        const ratingGap = Number(b.averageRating || 0) - Number(a.averageRating || 0);
        if (ratingGap !== 0) {
          return ratingGap;
        }

        const reviewGap = Number(b.reviewCount || 0) - Number(a.reviewCount || 0);
        if (reviewGap !== 0) {
          return reviewGap;
        }

        return Number(a.price || 0) - Number(b.price || 0);
      })
      .slice(0, 4);
  }, [products]);

  const handleRecommendationAddToCart = (product) => {
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

  const handleRecommendationToggleSaved = (product) => {
    const added = toggleSavedProduct(product);
    toast.success(added ? `${product.name} saved for later` : `${product.name} removed from saved items`);
  };


  const handleToggleFavoriteStore = (store) => {
    const added = toggleFavoriteStore(store);
    toast.success(added ? `${store.name} saved to favorite stores` : `${store.name} removed from favorite stores`);
  };

  return (
    <div className="w-full overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#f0fdf4_36%,#fff7ed_100%)] text-slate-900">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_28%),linear-gradient(135deg,#052e2b_0%,#0f172a_48%,#111827_100%)]" />
        <div className="absolute -left-16 top-24 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-[1.05fr_0.95fr] md:px-6 md:py-24">
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.28em] text-emerald-100">
              Discover trusted sellers in one place
            </span>

            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl md:text-6xl">
              The marketplace built to help shoppers buy faster
              <span className="block bg-[linear-gradient(90deg,#a7f3d0_0%,#fde68a_55%,#fdba74_100%)] bg-clip-text text-transparent">
                and sellers grow with confidence.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base text-slate-200 md:text-lg">
              Explore live products, discover branded stores, pay with mobile money, and follow every order from checkout to delivery without the usual guesswork.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/shop" className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#10b981_0%,#0f766e_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_32px_rgba(16,185,129,0.28)] transition hover:-translate-y-0.5">
                Explore Marketplace <FiArrowRight />
              </Link>
              {!user ? (
                <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/15">
                  Open Your Account
                </Link>
              ) : (
                <Link to="/orders" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/15">
                  Track Your Orders
                </Link>
              )}
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <StatPill label="Live products" value={marketplaceStats.products} />
              <StatPill label="Active stores" value={marketplaceStats.stores} />
              <StatPill label="Ready to ship" value={marketplaceStats.readyToShip} />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.55, delay: 0.1 }} className="relative">
            <div className="grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[2rem] border border-white/10 bg-white/10 p-5 backdrop-blur-xl shadow-2xl shadow-slate-950/35">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">Marketplace promise</p>
                <div className="mt-5 space-y-4">
                  {trustPoints.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl bg-white/10 p-3 text-emerald-100">
                            <Icon size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-white">{item.title}</p>
                            <p className="mt-1 text-sm text-slate-300">{item.desc}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.07)_100%)] p-5 backdrop-blur-xl shadow-2xl shadow-black/35">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100">Now trending</p>
                <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <div className="aspect-[4/4.4] overflow-hidden rounded-[1.25rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]">
                    <img
                      src={featuredProducts[0]?.image || '/images/hero-bag.png'}
                      alt={featuredProducts[0]?.name || 'Marketplace hero product'}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{featuredProducts[0]?.name || 'Seller-ready featured product'}</p>
                      <p className="mt-1 text-sm text-slate-300">
                        {featuredProducts[0]?.vendor?.storeName || featuredProducts[0]?.vendor?.name || 'Curated marketplace pick'}
                      </p>
                      {featuredProducts[0] ? (
                        <div className="mt-3">
                          <MarketplaceRating
                            averageRating={featuredProducts[0].averageRating}
                            reviewCount={featuredProducts[0].reviewCount}
                            compact
                            tone="dark"
                          />
                        </div>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-amber-100">
                      {featuredProducts[0]?.price ? `TZS ${Number(featuredProducts[0].price).toLocaleString()}` : 'Top pick'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {quickCollections.slice(0, 2).map((item) => (
                    <Link
                      key={item.title}
                      to={`/shop?${item.price ? `price=${item.price}` : `search=${encodeURIComponent(item.search)}`}`}
                      className={`rounded-2xl bg-gradient-to-br ${item.color} p-[1px] transition hover:-translate-y-0.5`}
                    >
                      <div className="rounded-[calc(1rem-1px)] bg-slate-950/80 px-4 py-4 text-white">
                        <p className="font-semibold">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-200">{item.subtitle}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {isSignedInShopper && (favoriteStoreCards.length || personalizedProducts.length || familiarStoreProducts.length) ? (
        <section className="mx-auto max-w-7xl space-y-6 px-4 py-12 md:px-6 md:py-16">
          {favoriteStoreCards.length ? (
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-500">Favorite stores</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Your seller shortcuts are ready</h2>
                  <p className="mt-2 max-w-2xl text-slate-600">Jump back into the storefronts you trust most, then keep building your basket from sellers already matching your style.</p>
                </div>
                <div className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">
                  {favoriteStoreCount} saved store{favoriteStoreCount === 1 ? "" : "s"}
                </div>
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-3">
                {favoriteStoreCards.slice(0, 3).map((store) => (
                  <article key={store.slug} className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                    <div className="grid grid-cols-[1.05fr_0.95fr] gap-0">
                      <div className="aspect-[4/4] bg-slate-100">
                        <img src={store.sampleImage || PLACEHOLDER_IMAGE} alt={store.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="flex flex-col justify-between p-5">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Saved storefront</p>
                          <h3 className="mt-2 text-lg font-black text-slate-900">{store.name}</h3>
                          {getStoreBadges(store).length ? (
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              {getStoreBadges(store).slice(0, 2).map((badge) => (
                                <span
                                  key={badge.label}
                                  className={`rounded-full px-3 py-1 font-semibold ${getStoreSignalToneClasses(badge.tone)}`}
                                >
                                  {badge.label}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <p className="mt-2 text-sm text-slate-600">{store.inStockCount || 0} ready now across {store.itemCount || 0} live product{Number(store.itemCount || 0) === 1 ? "" : "s"}.</p>
                          <p className="mt-2 text-sm font-medium text-slate-500">{getStoreNudge(store)}</p>
                          {Number(store.startingPrice || 0) > 0 ? (
                            <p className="mt-2 text-sm font-semibold text-emerald-700">Starts from {formatCurrency(store.startingPrice)}</p>
                          ) : null}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link to={`/stores/${store.slug}`} className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#10b981_0%,#0f766e_100%)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5">
                            Visit store <FiArrowRight />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleToggleFavoriteStore(store)}
                            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            <FiHeart /> Saved
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {personalizedProducts.length ? (
            <RecommendationShelf
              title="Picked for you"
              subtitle="Products shaped by what you saved and what you explored most recently."
              products={personalizedProducts}
              onAddToCart={handleRecommendationAddToCart}
              onToggleSaved={handleRecommendationToggleSaved}
              isSavedProduct={isSavedProduct}
              getCartQuantity={getCartQuantity}
              getReasonLabel={(product) => getRecommendationReason({ product, anchors: personalizedAnchors })}
              emptyMessage="Your personalized picks will appear here as you keep exploring the marketplace."
            />
          ) : null}

          {familiarStoreProducts.length ? (
            <RecommendationShelf
              title="From stores you keep exploring"
              subtitle="Fresh picks from seller shelves that already match your shopping pattern."
              products={familiarStoreProducts}
              onAddToCart={handleRecommendationAddToCart}
              onToggleSaved={handleRecommendationToggleSaved}
              isSavedProduct={isSavedProduct}
              getCartQuantity={getCartQuantity}
              getReasonLabel={(product) => getRecommendationReason({ product, anchors: personalizedAnchors })}
              emptyMessage="Store-led recommendations will appear here once you explore more seller pages."
            />
          ) : null}
        </section>
      ) : null}

      {topRatedProducts.length ? (
        <section className="mx-auto max-w-7xl px-4 py-2 md:px-6 md:py-4">
          <RecommendationShelf
            title="Top rated by shoppers"
            subtitle="See the marketplace picks buyers are rating most highly right now."
            products={topRatedProducts}
            onAddToCart={handleRecommendationAddToCart}
            onToggleSaved={handleRecommendationToggleSaved}
            isSavedProduct={isSavedProduct}
            getCartQuantity={getCartQuantity}
            getReasonLabel={(product) =>
              `${Number(product.averageRating || 0).toFixed(1)} stars from ${Number(product.reviewCount || 0)} shopper review${Number(product.reviewCount || 0) === 1 ? "" : "s"}`
            }
            emptyMessage="Top-rated products will appear here once shoppers start leaving reviews."
          />
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700">Featured shelves</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Products shoppers can move on quickly</h2>
            <p className="mt-2 max-w-2xl text-slate-600">A stronger front page helps buyers decide faster. These are the products already carrying the right marketplace energy.</p>
          </div>
          <Link to="/shop" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            View full catalog <FiArrowRight />
          </Link>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {(loading ? Array.from({ length: 4 }) : featuredProducts).map((product, index) => {
            const saved = !loading && product ? isSavedProduct(product._id) : false;
            const cartQty = !loading && product ? getCartQuantity(product._id) : 0;
            const badges = !loading && product ? getProductBadges(product, { index }) : [];
            const nudge = !loading && product ? getProductNudge(product, { index }) : "";

            return (
              <article key={product?._id || index} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <div className="relative aspect-[4/4.4] bg-slate-100">
                  {loading ? (
                    <div className="h-full w-full animate-pulse bg-slate-200" />
                  ) : (
                    <>
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.src = PLACEHOLDER_IMAGE;
                        }}
                      />
                      <div className="pointer-events-none absolute inset-x-4 top-4 flex flex-wrap gap-2 text-xs">
                        <span className={`rounded-full px-3 py-1 font-semibold ${Number(product.countInStock || 0) > 0 ? "bg-white/90 text-emerald-700" : "bg-slate-900/75 text-white"}`}>
                          {Number(product.countInStock || 0) > 0 ? `${Number(product.countInStock || 0)} ready now` : "Currently unavailable"}
                        </span>
                        {cartQty > 0 ? (
                          <span className="rounded-full bg-sky-50/95 px-3 py-1 font-semibold text-sky-700">
                            In cart x{cartQty}
                          </span>
                        ) : null}
                        {saved ? (
                          <span className="rounded-full bg-rose-50/95 px-3 py-1 font-semibold text-rose-700">
                            Saved by you
                          </span>
                        ) : null}
                        {badges.slice(0, 2).map((badge) => (
                          <span key={badge.label} className={`rounded-full px-3 py-1 font-semibold ${getSignalToneClasses(badge.tone)}`}>
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {loading ? 'Loading' : 'Featured marketplace pick'}
                      </p>
                      <h3 className="mt-2 text-lg font-black text-slate-900">{loading ? 'Loading product' : product.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {loading ? 'Preparing shelf details...' : product.vendor?.storeSlug ? `From ${product.vendor.storeName || product.vendor.name}` : 'Marketplace seller'}
                      </p>
                      {!loading ? (
                        <div className="mt-2">
                          <MarketplaceRating
                            averageRating={product.averageRating}
                            reviewCount={product.reviewCount}
                            compact
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Price</p>
                      <p className="text-xl font-black text-emerald-700">{loading ? '...' : `TZS ${Number(product.price || 0).toLocaleString()}`}</p>
                    </div>
                  </div>

                  {loading ? (
                    <div className="mt-4 h-12 animate-pulse rounded-2xl bg-slate-100" />
                  ) : (
                    <>
                      {badges.length > 2 ? (
                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                          {badges.slice(2, 4).map((badge) => (
                            <span key={badge.label} className={`rounded-full px-3 py-1 font-semibold ${getSignalToneClasses(badge.tone)}`}>
                              {badge.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-4 text-sm font-medium leading-6 text-slate-600">{nudge}</p>
                    </>
                  )}

                  {!loading ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link to={`/product/${product._id}`} className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                        View product
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRecommendationToggleSaved(product)}
                        className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          saved
                            ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <FiHeart /> {saved ? 'Saved' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRecommendationAddToCart(product)}
                        disabled={Number(product.countInStock || 0) <= 0}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#10b981_0%,#0f766e_100%)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FiShoppingBag /> {cartQty > 0 ? 'Add another' : 'Add to cart'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white/80">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-18">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-600">Storefronts to watch</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Let strong sellers become part of the shopping story</h2>
              <p className="mt-2 max-w-2xl text-slate-600">Marketplace growth looks better when shoppers can discover trusted stores, not just individual items.</p>
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {(featuredStores.length ? featuredStores : Array.from({ length: 3 })).map((store, index) => (
              <article key={store?.slug || index} className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                    <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                      <FiPackage size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{store?.name || 'Marketplace store'}</p>
                      <p className="text-sm text-slate-500">{store ? `${store.itemCount} live products` : 'Seller shelf loading...'}</p>
                      {store ? (
                        <div className="mt-2">
                          <MarketplaceRating
                            averageRating={store.averageRating}
                            reviewCount={store.reviewCount}
                            compact
                          />
                        </div>
                      ) : null}
                      {store && getStoreBadges(store).length ? (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          {getStoreBadges(store).slice(0, 2).map((badge) => (
                            <span
                              key={badge.label}
                              className={`rounded-full px-3 py-1 font-semibold ${getStoreSignalToneClasses(badge.tone)}`}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                <div className="grid grid-cols-[1.1fr_0.9fr] gap-0">
                  <div className="aspect-[4/4] bg-slate-100">
                    {store?.sampleImage ? <img src={store.sampleImage} alt={store.name} className="h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse bg-slate-200" />}
                  </div>
                  <div className="flex flex-col justify-between p-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Seller shelf</p>
                      <p className="mt-3 text-sm text-slate-600">{store ? `${store.inStockCount} products ready for shoppers now.` : 'Preparing seller view...'}</p>
                      {store ? (
                        <p className="mt-2 text-sm font-medium text-slate-500">{getStoreNudge(store)}</p>
                      ) : null}
                    </div>
                    {store?.slug ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link to={`/stores/${store.slug}`} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                          Visit store <FiArrowRight />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleToggleFavoriteStore(store)}
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition ${
                            isFavoriteStore(store.slug)
                              ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <FiHeart /> {isFavoriteStore(store.slug) ? "Saved" : "Save store"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
        <div className="grid gap-5 lg:grid-cols-3">
          {quickCollections.map((item) => (
            <Link
              key={item.title}
              to={`/shop?${item.price ? `price=${item.price}` : `search=${encodeURIComponent(item.search)}`}`}
              className={`rounded-[28px] bg-gradient-to-br ${item.color} p-[1px] shadow-[0_20px_40px_rgba(15,23,42,0.08)] transition hover:-translate-y-1`}
            >
              <div className="h-full rounded-[27px] bg-white/95 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-2xl bg-slate-950/5 p-3 text-slate-700">
                    <FiBox size={20} />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Marketplace lane</span>
                </div>
                <h3 className="mt-6 text-2xl font-black text-slate-900">{item.title}</h3>
                <p className="mt-2 text-slate-600">{item.subtitle}</p>
                <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  Shop this lane <FiArrowRight />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{Number(value || 0).toLocaleString()}</p>
    </div>
  );
}
