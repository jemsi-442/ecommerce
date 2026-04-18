import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowRight, FiFilter, FiHeart, FiPackage, FiSearch, FiShoppingBag, FiSliders, FiStar, FiTruck } from "react-icons/fi";
import api from "../utils/axios";
import { extractList } from "../utils/apiShape";
import RecommendationShelf from "../components/RecommendationShelf";
import MarketplaceRating from "../components/MarketplaceRating";
import { useCart } from "../hooks/useCart";
import { useSavedProducts } from "../hooks/useSavedProducts";
import { PLACEHOLDER_IMAGE, resolveImageUrl } from "../utils/image";
import { getProductBadges, getProductNudge, getSignalToneClasses } from "../utils/productSignals";
import { getStoreBadges, getStoreNudge, getStoreSignalToneClasses } from "../utils/storeSignals";
import { ProductGridSkeleton } from "../components/Skeleton";
import { useToast } from "../hooks/useToast";

const PRICE_RANGES = [
  { label: "All prices", value: "all" },
  { label: "Under 50,000", value: "0-50000" },
  { label: "50,000 - 100,000", value: "50000-100000" },
  { label: "100,000+", value: "100000-10000000" },
];

const SHOPPING_LANES = [
  {
    id: "ready-now",
    title: "Ready now",
    subtitle: "Focus on items shoppers can move to checkout immediately.",
    icon: FiTruck,
    style: "from-[#102A43] via-[#163A5F] to-[#28507A]",
    apply: ({ setSearch, setPrice, setInStockOnly }) => {
      setSearch("");
      setPrice("all");
      setInStockOnly(true);
    },
  },
  {
    id: "value-picks",
    title: "Value picks",
    subtitle: "Pull in sharp prices without losing marketplace quality.",
    icon: FiShoppingBag,
    style: "from-[#F28C28] via-[#F59E0B] to-[#FDBA74]",
    apply: ({ setSearch, setPrice, setInStockOnly }) => {
      setSearch("");
      setPrice("0-50000");
      setInStockOnly(false);
    },
  },
  {
    id: "seller-highlights",
    title: "Seller highlights",
    subtitle: "Browse products from stores already standing out in the catalog.",
    icon: FiStar,
    style: "from-[#102A43] via-[#1C4268] to-[#F28C28]",
    apply: ({ setSearch, setPrice, setInStockOnly }) => {
      setSearch("seller");
      setPrice("all");
      setInStockOnly(false);
    },
  },
];

export default function Shop() {
  const { addToCart, cart } = useCart();
  const { isSavedProduct, toggleSavedProduct } = useSavedProducts();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [price, setPrice] = useState(() => searchParams.get("price") || "all");
  const [inStockOnly, setInStockOnly] = useState(() => searchParams.get("stock") === "1");

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) {
      params.set("search", search.trim());
    }
    if (price !== "all") {
      params.set("price", price);
    }
    if (inStockOnly) {
      params.set("stock", "1");
    }
    setSearchParams(params, { replace: true });
  }, [search, price, inStockOnly, setSearchParams]);

  useEffect(() => {
    let mounted = true;

    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError("");
        const { data } = await api.get("/products?status=approved");
        const rawProducts = extractList(data, ["products", "items"]);

        const normalizedProducts = rawProducts.map((product) => ({
          ...product,
          image: resolveImageUrl([product.imageUrl, product.image, ...(product.images || [])], PLACEHOLDER_IMAGE),
          countInStock:
            typeof product.countInStock === "number"
              ? product.countInStock
              : typeof product.stock === "number"
                ? product.stock
                : 0,
        }));

        if (mounted) {
          setProducts(normalizedProducts);
        }
      } catch (err) {
        if (mounted) {
          setError("We could not load the marketplace catalog right now.");
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

  const cartProductQuantities = useMemo(() => {
    const quantities = new Map();

    cart.forEach((item) => {
      const key = String(item.productId);
      quantities.set(key, (quantities.get(key) || 0) + Number(item.qty || 0));
    });

    return quantities;
  }, [cart]);

  const getCartQuantity = (productId) => cartProductQuantities.get(String(productId)) || 0;

  const marketplaceSummary = useMemo(() => {
    const storeMap = new Map();
    let inStock = 0;
    let valuePicks = 0;

    products.forEach((product) => {
      if (product.vendor?.storeSlug) {
        storeMap.set(product.vendor.storeSlug, product.vendor);
      }
      if ((product.countInStock || 0) > 0) {
        inStock += 1;
      }
      if (Number(product.price || 0) > 0 && Number(product.price || 0) <= 50000) {
        valuePicks += 1;
      }
    });

    return {
      products: products.length,
      stores: storeMap.size,
      inStock,
      valuePicks,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        const term = search.toLowerCase();
        if (!term) {
          return true;
        }

        return [product.name, product.description, product.vendor?.storeName, product.vendor?.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .filter((product) => {
        if (price === "all") return true;
        const [min, max] = price.split("-").map(Number);
        return Number(product.price) >= min && Number(product.price) <= max;
      })
      .filter((product) => (inStockOnly ? product.countInStock > 0 : true));
  }, [products, search, price, inStockOnly]);

  const highlightedStores = useMemo(() => {
    const storeMap = new Map();

    filteredProducts.forEach((product) => {
      if (!product.vendor?.storeSlug) {
        return;
      }

      const current = storeMap.get(product.vendor.storeSlug) || {
        slug: product.vendor.storeSlug,
        name: product.vendor.storeName || product.vendor.name || product.vendor.storeSlug,
        itemCount: 0,
        readyNowCount: 0,
        sampleImage: product.image,
        startingPrice: Number(product.price || 0),
        ratingValue: 0,
        reviewCount: 0,
      };
      current.itemCount += 1;
      if (Number(product.countInStock || 0) > 0) {
        current.readyNowCount += 1;
      }
      if (!current.sampleImage) {
        current.sampleImage = product.image;
      }
      if (Number(product.price || 0) > 0) {
        current.startingPrice = current.startingPrice > 0
          ? Math.min(current.startingPrice, Number(product.price || 0))
          : Number(product.price || 0);
      }
      if (Number(product.reviewCount || 0) > 0) {
        current.ratingValue += Number(product.averageRating || 0) * Number(product.reviewCount || 0);
        current.reviewCount += Number(product.reviewCount || 0);
      }
      storeMap.set(product.vendor.storeSlug, current);
    });

    return Array.from(storeMap.values())
      .map((store) => ({
        ...store,
        averageRating: store.reviewCount ? Number((store.ratingValue / store.reviewCount).toFixed(1)) : 0,
      }))
      .slice(0, 4);
  }, [filteredProducts]);

  const topRatedProducts = useMemo(() => {
    return filteredProducts
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
  }, [filteredProducts]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count += 1;
    if (price !== "all") count += 1;
    if (inStockOnly) count += 1;
    return count;
  }, [search, price, inStockOnly]);

  const handleToggleSaved = (product) => {
    const added = toggleSavedProduct(product);
    toast.success(added ? `${product.name} saved` : `${product.name} removed`);
  };

  const handleAddToCart = (product) => {
    if (product.countInStock <= 0) {
      toast.error(`${product.name} is currently unavailable`);
      return;
    }

    addToCart({
      productId: product._id,
      name: product.name,
      price: Number(product.price),
      image: product.image,
      qty: 1,
      stock: product.countInStock,
      variant: null,
    });

    toast.success(`${product.name} added to cart`);
  };

  const resetFilters = () => {
    setSearch("");
    setPrice("all");
    setInStockOnly(false);
  };

  const applyLane = (lane) => {
    lane.apply({ setSearch, setPrice, setInStockOnly });
    setMobileFiltersOpen(false);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f0fdf4_28%,#fff7ed_100%)]">
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#081B2E_0%,#102A43_46%,#1C4268_100%)] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(242,140,40,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.18),transparent_26%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-orange-100">Marketplace catalog</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Find the products and stores worth your attention.</h1>
              <p className="mt-4 max-w-2xl text-slate-200">
                Browse the full marketplace, compare seller shelves, and move from discovery to checkout without friction.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <SummaryCard label="Live products" value={marketplaceSummary.products} />
              <SummaryCard label="Active stores" value={marketplaceSummary.stores} />
              <SummaryCard label="Ready now" value={marketplaceSummary.inStock} />
              <SummaryCard label="Value picks" value={marketplaceSummary.valuePicks} />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_35px_rgba(15,23,42,0.05)] md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#102A43]">Shopping lanes</p>
              <h2 className="mt-1 text-2xl font-black text-slate-900">Open the marketplace through stronger entry points</h2>
              <p className="mt-2 max-w-2xl text-slate-600">Pick a shopping lane to shape the shelf around speed, value, or seller discovery before you start comparing products.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
              <FiFilter /> {activeFilterCount ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active` : "Full marketplace view"}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {SHOPPING_LANES.map((lane) => {
              const Icon = lane.icon;
              return (
                <button
                  key={lane.id}
                  type="button"
                  onClick={() => applyLane(lane)}
                  className={`rounded-[24px] bg-gradient-to-br ${lane.style} p-[1px] text-left transition hover:-translate-y-0.5`}
                >
                  <div className="h-full rounded-[23px] bg-slate-950/85 px-5 py-5 text-white">
                    <div className="flex items-center justify-between gap-3">
                      <div className="rounded-2xl bg-white/10 p-3 text-white">
                        <Icon size={18} />
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Open lane</span>
                    </div>
                    <h3 className="mt-5 text-xl font-black">{lane.title}</h3>
                    <p className="mt-2 text-sm text-slate-200">{lane.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="hidden xl:block">
            <FilterPanel
              search={search}
              setSearch={setSearch}
              price={price}
              setPrice={setPrice}
              inStockOnly={inStockOnly}
              setInStockOnly={setInStockOnly}
              resetFilters={resetFilters}
            />
          </aside>

          <div>
            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-[0_18px_35px_rgba(15,23,42,0.05)] md:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Showing {filteredProducts.length} product{filteredProducts.length === 1 ? "" : "s"}</p>
                  <p className="mt-1 text-sm text-slate-500">Use filters to narrow the shelf, compare seller shelves, and add stronger picks straight to cart.</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen((value) => !value)}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 xl:hidden"
                  >
                    <FiSliders /> Filters
                  </button>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-[#102A43]">
                    <FiFilter /> Curated marketplace view
                  </div>
                </div>
              </div>

              {mobileFiltersOpen ? (
                <div className="mt-4 border-t border-slate-100 pt-4 xl:hidden">
                  <FilterPanel
                    search={search}
                    setSearch={setSearch}
                    price={price}
                    setPrice={setPrice}
                    inStockOnly={inStockOnly}
                    setInStockOnly={setInStockOnly}
                    resetFilters={resetFilters}
                    compact
                  />
                </div>
              ) : null}
            </div>

            {highlightedStores.length ? (
              <div className="mt-5 rounded-[28px] border border-amber-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_100%)] p-5 shadow-[0_18px_35px_rgba(15,23,42,0.05)]">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">Seller shelves</p>
                    <h2 className="mt-1 text-xl font-black text-slate-900">Stores showing up in your current view</h2>
                    <p className="mt-1 text-sm text-slate-500">Move into seller-led discovery when a storefront is matching the shopping lane you opened.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {highlightedStores.map((store) => {
                    const storeBadges = getStoreBadges(store);

                    return (
                      <Link key={store.slug} to={`/stores/${store.slug}`} className="overflow-hidden rounded-[24px] border border-white bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
                        <div className="aspect-[4/2.7] bg-slate-100">
                          {store.sampleImage ? (
                            <img src={store.sampleImage} alt={store.name} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{store.name}</p>
                              <p className="mt-1 text-sm text-slate-500">{store.itemCount} products in view</p>
                              <div className="mt-2">
                                <MarketplaceRating
                                  averageRating={store.averageRating}
                                  reviewCount={store.reviewCount}
                                  compact
                                />
                              </div>
                              {storeBadges.length ? (
                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                  {storeBadges.slice(0, 2).map((badge) => (
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
                            <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                              <FiPackage size={16} />
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-[#102A43]">{store.readyNowCount} ready now</span>
                            {store.startingPrice > 0 ? (
                              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">Starts from TZS {Number(store.startingPrice).toLocaleString()}</span>
                            ) : null}
                          </div>
                          <p className="mt-3 text-sm font-medium text-slate-500">{getStoreNudge(store)}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {topRatedProducts.length ? (
              <div className="mt-5">
                <RecommendationShelf
                  title="Top rated in this view"
                  subtitle="These are the highest-rated products inside your current marketplace filter view."
                  products={topRatedProducts}
                  onAddToCart={handleAddToCart}
                  onToggleSaved={handleToggleSaved}
                  isSavedProduct={isSavedProduct}
                  getCartQuantity={getCartQuantity}
                  getReasonLabel={(product) =>
                    `${Number(product.averageRating || 0).toFixed(1)} stars from ${Number(product.reviewCount || 0)} shopper review${Number(product.reviewCount || 0) === 1 ? "" : "s"}`
                  }
                  emptyMessage="Top-rated products will appear here when the current view includes reviewed items."
                />
              </div>
            ) : null}

            {loading && <div className="mt-6"><ProductGridSkeleton count={6} /></div>}

            {error && <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-600">{error}</div>}

            {!loading && !error && filteredProducts.length === 0 && (
              <div className="mt-10 rounded-[28px] border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
                <p className="text-lg font-semibold text-slate-900">Nothing matches this view yet.</p>
                <p className="mt-2">Try another search term, widen your price range, or open the full catalog again.</p>
                <button onClick={resetFilters} className="mt-5 rounded-full bg-[linear-gradient(135deg,#102A43_0%,#081B2E_100%)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">
                  Reset filters
                </button>
              </div>
            )}

            <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product, index) => {
                const saved = isSavedProduct(product._id);
                const cartQty = getCartQuantity(product._id);
                const badges = getProductBadges(product, { index });
                const heroBadges = badges.slice(0, 2);
                const detailBadges = badges.slice(2);
                const nudge = getProductNudge(product, { index });

                return (
                  <motion.article
                    key={product._id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_24px_55px_rgba(15,23,42,0.12)]"
                  >
                    <div className="relative aspect-[4/4.6] bg-slate-100">
                      <img
                        src={product.image}
                        alt={product.name}
                        onError={(event) => {
                          event.currentTarget.src = PLACEHOLDER_IMAGE;
                        }}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute left-3 top-3 flex max-w-[80%] flex-wrap gap-2">
                        <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                          {product.countInStock > 0 ? "Ready to buy" : "Out of stock"}
                        </span>
                        {cartQty > 0 ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[#102A43] shadow-sm">In cart x{cartQty}</span>
                        ) : null}
                        {heroBadges.map((badge) => (
                          <span key={badge.label} className={`rounded-full px-3 py-1 text-xs font-semibold ${getSignalToneClasses(badge.tone)}`}>
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        aria-label="Save for later"
                        onClick={() => handleToggleSaved(product)}
                        className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border bg-white/90 transition ${
                          saved
                            ? "border-orange-200 text-orange-500"
                            : "border-slate-200 text-slate-600 hover:text-orange-500"
                        }`}
                      >
                        <FiHeart />
                      </button>
                    </div>

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="line-clamp-1 text-lg font-black text-slate-900">{product.name}</h3>
                          {product.vendor?.storeSlug ? (
                            <Link to={`/stores/${product.vendor.storeSlug}`} className="mt-1 inline-flex text-sm font-medium text-amber-600 hover:text-amber-700">
                              {product.vendor.storeName || product.vendor.name}
                            </Link>
                          ) : (
                            <p className="mt-1 text-sm text-slate-500">Marketplace seller</p>
                          )}
                          <div className="mt-2">
                            <MarketplaceRating
                              averageRating={product.averageRating}
                              reviewCount={product.reviewCount}
                              compact
                            />
                          </div>
                        </div>
                        <span className="text-right text-lg font-black text-[#102A43]">TZS {Number(product.price).toLocaleString()}</span>
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm text-slate-500">
                        {product.description || "A marketplace-ready product with seller-backed fulfillment."}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                        {saved ? (
                          <span className="rounded-full bg-orange-50 px-3 py-1 font-semibold text-orange-700">Saved by you</span>
                        ) : null}
                        {detailBadges.map((badge) => (
                          <span key={badge.label} className={`rounded-full px-3 py-1 font-semibold ${getSignalToneClasses(badge.tone)}`}>
                            {badge.label}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Why this stands out</p>
                        <p className="mt-1 text-sm font-medium text-slate-600">{nudge}</p>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                        <span className={`rounded-full px-3 py-1 font-semibold ${product.countInStock > 0 ? "bg-slate-100 text-[#102A43]" : "bg-slate-100 text-slate-500"}`}>
                          {product.countInStock > 0 ? `${product.countInStock} in stock` : "Currently unavailable"}
                        </span>
                        {product.vendor?.storeSlug ? (
                          <Link to={`/stores/${product.vendor.storeSlug}`} className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900">
                            Store <FiArrowRight size={14} />
                          </Link>
                        ) : null}
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <Link
                          to={`/product/${product._id}`}
                          className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          View details
                        </Link>
                        <button
                          onClick={() => handleAddToCart(product)}
                          disabled={product.countInStock === 0}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#102A43_0%,#081B2E_100%)] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <FiShoppingBag /> {cartQty > 0 ? "Add another" : "Add to cart"}
                        </button>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterPanel({ search, setSearch, price, setPrice, inStockOnly, setInStockOnly, resetFilters, compact = false }) {
  return (
    <div className={`rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_35px_rgba(15,23,42,0.05)] ${compact ? "" : "sticky top-24"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#102A43]">Refine view</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">Shape the shelf</h2>
        </div>
        <button onClick={resetFilters} className="text-sm font-semibold text-slate-500 hover:text-slate-900">
          Reset
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-700">Search</label>
          <div className="relative mt-2">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search products or stores"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 py-3 pl-10 pr-4 outline-none transition focus:border-[#102A43] focus:ring-2 focus:ring-[#102A43]/10"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Price range</label>
          <select
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#102A43] focus:ring-2 focus:ring-[#102A43]/10"
          >
            {PRICE_RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={() => setInStockOnly((value) => !value)}
            className="accent-[#102A43]"
          />
          Show only products ready right now
        </label>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{Number(value || 0).toLocaleString()}</p>
    </div>
  );
}
