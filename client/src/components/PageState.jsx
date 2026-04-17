export default function PageState({
  title,
  description,
  tone = "neutral",
}) {
  const toneStyles = {
    neutral:
      "border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] text-slate-700 shadow-[0_16px_36px_rgba(15,23,42,0.05)]",
    error:
      "border-rose-200 bg-[linear-gradient(135deg,#fff1f2_0%,#fff7ed_100%)] text-rose-700 shadow-[0_16px_36px_rgba(244,63,94,0.08)]",
    warning:
      "border-amber-200 bg-[linear-gradient(135deg,#fffbeb_0%,#fff7ed_100%)] text-amber-700 shadow-[0_16px_36px_rgba(245,158,11,0.08)]",
  };

  return (
    <div className={`rounded-[24px] border p-4 md:p-5 ${toneStyles[tone] || toneStyles.neutral}`}>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] opacity-70">System Update</p>
      <p className="mt-2 font-black">{title}</p>
      {description ? <p className="mt-1 text-sm opacity-90">{description}</p> : null}
    </div>
  );
}
