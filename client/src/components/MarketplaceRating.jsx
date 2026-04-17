import { FiStar } from "react-icons/fi";

export default function MarketplaceRating({
  averageRating = 0,
  reviewCount = 0,
  compact = false,
  tone = "light",
}) {
  const safeAverage = Number(averageRating || 0);
  const safeCount = Number(reviewCount || 0);

  if (safeCount <= 0) {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
          tone === "dark"
            ? "bg-white/10 text-slate-200"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        <FiStar className="text-slate-400" />
        No shopper ratings yet
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold ${
        compact ? "text-xs" : "text-sm"
      } ${
        tone === "dark"
          ? "bg-amber-200/10 text-amber-100"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      <FiStar className="fill-current" />
      {safeAverage.toFixed(1)}
      <span className={tone === "dark" ? "text-slate-200/80" : "text-slate-500"}>
        {safeCount} review{safeCount === 1 ? "" : "s"}
      </span>
    </span>
  );
}
