import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiCheckCircle, FiHeart, FiMinus, FiPlus, FiShield, FiShoppingCart, FiTrash2, FiTruck } from "react-icons/fi";
import RecommendationShelf from "../components/RecommendationShelf";
import api from "../utils/axios";
import { extractList } from "../utils/apiShape";
import { useCart } from "../hooks/useCart";
import { useSavedProducts } from "../hooks/useSavedProducts";
import { getRecommendedProducts, getRecommendationReason, normalizeMarketplaceProduct } from "../utils/marketplaceRecommendations";
import { useToast } from "../hooks/useToast";

export default function Cart() {
  const { cart, removeFromCart, updateQty, clearCart, addToCart } = useCart();
  const { isSavedProduct, toggleSavedProduct, savedProducts, recentProducts } = useSavedProducts();
  const toast = useToast();
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    let mounted = true;

    const fetchCatalog = async () => {
      try {
        const { data } = await api.get('/products?status=approved');
        const normalized = extractList(data, ['products', 'items']).map((entry) => normalizeMarketplaceProduct(entry));
        if (mounted) {
          setCatalog(normalized);
        }
      } catch {
        if (mounted) {
          setCatalog([]);
        }
      }
    };

    fetchCatalog();

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

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
    const delivery = subtotal > 150000 ? 0 : 5000;
    const total = subtotal + delivery;

    return { subtotal, delivery, total };
  }, [cart]);

  const freeDeliveryRemaining = Math.max(0, 150000 - Number(totals.subtotal || 0));

  const recommendationAnchors = useMemo(() => {
    const cartAnchors = cart.map((item) => ({
      _id: item.productId,
      name: item.name,
      price: Number(item.price || 0),
      countInStock: Number(item.stock || 0),
      vendor: item.vendor || null,
      description: '',
    }));

    return [...cartAnchors, ...savedProducts.slice(0, 3), ...recentProducts.slice(0, 3)].slice(0, 6);
  }, [cart, recentProducts, savedProducts]);

  const recommendedProducts = useMemo(() => {
    return getRecommendedProducts({
      catalog,
      anchors: recommendationAnchors,
      excludeIds: cart.map((item) => item.productId),
      limit: 4,
    });
  }, [catalog, cart, recommendationAnchors]);

  const handleToggleSaved = (item) => {
    const added = toggleSavedProduct({
      _id: item.productId || item._id,
      name: item.name,
      price: Number(item.price || 0),
      image: item.image,
      countInStock: Number(item.stock || item.countInStock || 0),
      vendor: item.vendor || null,
      description: item.description || '',
    });

    toast.success(added ? `${item.name} saved for later` : `${item.name} removed from saved items`);
  };

  const handleRecommendationToggleSaved = (product) => {
    const added = toggleSavedProduct(product);
    toast.success(added ? `${product.name} saved for later` : `${product.name} removed from saved items`);
  };

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

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm md:p-14">
          <FiShoppingCart className="mx-auto mb-4 text-5xl text-slate-400" />
          <h2 className="text-3xl font-black text-slate-900">Your cart is empty</h2>
          <p className="mt-3 text-slate-500">Add products from the marketplace first.</p>
          <Link to="/shop" className="btn-primary mt-7 inline-flex items-center gap-2">
            Continue shopping <FiArrowRight />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#fff7ed_45%,#ffffff_100%)] px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[32px] border border-white/80 bg-white/92 p-6 shadow-[0_24px_50px_rgba(15,23,42,0.08)] md:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-rose-400">Checkout ready</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Your cart is lined up for a smooth checkout.</h1>
              <p className="mt-3 max-w-2xl text-slate-600">Review quantities, keep stronger picks, and move to mobile money checkout with a clearer summary of what happens next.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <QuickStat label="Items" value={cart.reduce((sum, item) => sum + Number(item.qty || 0), 0)} />
              <QuickStat label="Saved" value={savedProducts.length} />
              <QuickStat label="Ready now" value={cart.filter((item) => Number(item.stock || 0) > 0).length} />
            </div>
          </div>
        </section>

        <div className="grid gap-6 md:gap-8 lg:grid-cols-3">
          <section className="lg:col-span-2 space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.05)] md:p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 md:text-3xl">Shopping Cart</h2>
                  <p className="mt-1 text-slate-500">Everything here is ready for one cleaner move into checkout.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">Mobile money checkout</span>
                  <span className="rounded-full bg-sky-50 px-3 py-1 font-semibold text-sky-700">Trackable order updates</span>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {cart.map((item) => {
                  const saved = isSavedProduct(item.productId);
                  const lineTotal = Number(item.price || 0) * Number(item.qty || 0);
                  const ready = Number(item.stock || 0) > 0;

                  return (
                    <article
                      key={item.id}
                      className="grid gap-4 rounded-[24px] border border-slate-200 p-4 sm:grid-cols-[120px_1fr] md:p-5"
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        onError={(event) => {
                          event.currentTarget.src = "/images/placeholder-bag.svg";
                        }}
                        className="h-32 w-full rounded-2xl object-cover sm:h-28"
                      />

                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
                            {item.variant ? <p className="text-sm text-slate-500">{item.variant.name}</p> : null}
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              <span className={`rounded-full px-3 py-1 font-semibold ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                {ready ? 'Ready for checkout' : 'Currently unavailable'}
                              </span>
                              {saved ? (
                                <span className="rounded-full bg-rose-50 px-3 py-1 font-semibold text-rose-700">Saved by you</span>
                              ) : null}
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="h-9 w-9 rounded-full border border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-600"
                            aria-label="Remove item"
                          >
                            <FiTrash2 className="mx-auto" />
                          </button>
                        </div>

                        <p className="mt-3 font-extrabold text-rose-600">TZS {Number(item.price).toLocaleString()}</p>

                        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-300">
                            <button onClick={() => updateQty(item.id, item.qty - 1)} className="px-3 py-2 hover:bg-slate-100">
                              <FiMinus />
                            </button>
                            <span className="px-4 font-semibold text-slate-800">{item.qty}</span>
                            <button onClick={() => updateQty(item.id, item.qty + 1)} className="px-3 py-2 hover:bg-slate-100">
                              <FiPlus />
                            </button>
                          </div>

                          <p className="text-sm text-slate-500">
                            Item total:{' '}
                            <span className="font-semibold text-slate-800">TZS {lineTotal.toLocaleString()}</span>
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleSaved(item)}
                            className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                              saved
                                ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <FiHeart /> {saved ? 'Saved' : 'Save for later'}
                          </button>
                          <Link
                            to={`/product/${item.productId}`}
                            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            View product
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <aside>
            <div className="sticky top-24 space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.05)] md:p-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-500">Checkout summary</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Order Summary</h2>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#fffaf5_0%,#f8fafc_100%)] p-4">
                <div className="space-y-3 text-sm text-slate-700">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>TZS {totals.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery</span>
                    <span>{totals.delivery === 0 ? 'FREE' : `TZS ${totals.delivery.toLocaleString()}`}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-black text-slate-900">
                    <span>Total</span>
                    <span className="text-rose-600">TZS {totals.total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm text-slate-600">
                  {freeDeliveryRemaining > 0 ? (
                    <p>Add TZS {freeDeliveryRemaining.toLocaleString()} more to unlock free delivery.</p>
                  ) : (
                    <p>You have already unlocked free delivery on this order.</p>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                    <FiShield />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Secure mobile money checkout</p>
                    <p className="mt-1">You will confirm payment on your phone after placing the order.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
                    <FiTruck />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Track every order update</p>
                    <p className="mt-1">Payment confirmation and delivery progress stay visible in your account.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
                    <FiCheckCircle />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Review before you pay</p>
                    <p className="mt-1">You will confirm delivery details and network selection on the next step.</p>
                  </div>
                </div>
              </div>

              <Link to="/checkout" className="btn-primary inline-flex w-full items-center justify-center gap-2">
                Continue to checkout <FiArrowRight />
              </Link>

              <button onClick={clearCart} className="btn-secondary w-full">
                Clear cart
              </button>
            </div>
          </aside>
        </div>

        <RecommendationShelf
          title="Recommended for your cart"
          subtitle="Marketplace picks that match what you already selected, saved, or viewed recently."
          products={recommendedProducts}
          onAddToCart={handleRecommendationAddToCart}
          onToggleSaved={handleRecommendationToggleSaved}
          isSavedProduct={isSavedProduct}
          getCartQuantity={getCartQuantity}
          getReasonLabel={(product) => getRecommendationReason({ product, anchors: recommendationAnchors })}
          emptyMessage="More recommendations will appear here as your cart and saved products grow."
        />
      </div>
    </div>
  );
}

function QuickStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{Number(value || 0).toLocaleString()}</p>
    </div>
  );
}
