import { Link } from "react-router-dom";
import { FiHeart, FiPackage, FiShoppingBag } from "react-icons/fi";
import MarketplaceRating from "./MarketplaceRating";
import { getProductBadges, getProductNudge, getSignalToneClasses } from "../utils/productSignals";

export default function RecommendationShelf({
  title,
  subtitle,
  products = [],
  onAddToCart,
  onToggleSaved,
  isSavedProduct,
  getCartQuantity,
  getReasonLabel,
  emptyMessage = "No recommendations available right now.",
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.05)] md:p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-slate-100 p-3 text-[#102A43]">
          <FiPackage size={18} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Recommended next</p>
          <h2 className="mt-1 text-xl font-black text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>

      {products.length ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {products.map((product, index) => {
            const saved = isSavedProduct?.(product._id);
            const cartQty = Number(getCartQuantity?.(product._id) || 0);
            const reasonLabel = getReasonLabel?.(product, index);
            const badges = getProductBadges(product, { index });
            const nudge = getProductNudge(product, { index });
            return (
              <article key={product._id} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                <Link to={`/product/${product._id}`} className="block aspect-[4/4.1] overflow-hidden bg-slate-100">
                  <img src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-300 hover:scale-105" />
                </Link>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link to={`/product/${product._id}`} className="line-clamp-1 text-base font-black text-slate-900 hover:text-[#102A43]">
                        {product.name}
                      </Link>
                      <p className="mt-1 text-sm text-slate-500">{product.vendor?.storeName || product.vendor?.name || "Marketplace seller"}</p>
                      <div className="mt-2">
                        <MarketplaceRating
                          averageRating={product.averageRating}
                          reviewCount={product.reviewCount}
                          compact
                        />
                      </div>
                    </div>
                    <span className="text-sm font-black text-[#102A43]">TZS {Number(product.price || 0).toLocaleString()}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-3 py-1 font-semibold ${Number(product.countInStock || 0) > 0 ? "bg-slate-100 text-[#102A43]" : "bg-slate-200 text-slate-500"}`}>
                      {Number(product.countInStock || 0) > 0 ? `${Number(product.countInStock || 0)} ready now` : "Currently unavailable"}
                    </span>
                    {cartQty > 0 ? (
                      <span className="rounded-full bg-orange-50 px-3 py-1 font-semibold text-orange-700">
                        In cart x{cartQty}
                      </span>
                    ) : null}
                    {saved ? (
                      <span className="rounded-full bg-orange-50 px-3 py-1 font-semibold text-orange-700">
                        Saved by you
                      </span>
                    ) : null}
                    {badges.slice(0, 2).map((badge) => (
                      <span key={badge.label} className={`rounded-full px-3 py-1 font-semibold ${getSignalToneClasses(badge.tone)}`}>
                        {badge.label}
                      </span>
                    ))}
                  </div>

                  {reasonLabel ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Why this fits</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{reasonLabel}</p>
                    </div>
                  ) : null}

                  <p className="mt-3 text-sm font-medium text-slate-600">{nudge}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleSaved?.(product)}
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
                      onClick={() => onAddToCart?.(product)}
                      disabled={Number(product.countInStock || 0) <= 0}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#102A43_0%,#081B2E_100%)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FiShoppingBag /> {cartQty > 0 ? "Add another" : "Add to cart"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-slate-500">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}
