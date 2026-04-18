export function ProductGridSkeleton({ count = 6 }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)] animate-pulse">
          <div className="aspect-square bg-slate-200" />
          <div className="p-4 md:p-5 space-y-3">
            <div className="h-4 w-2/3 rounded bg-slate-200" />
            <div className="h-4 w-1/3 rounded bg-slate-200" />
            <div className="h-3 w-1/2 rounded bg-slate-200" />
            <div className="h-9 rounded-full bg-orange-100/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="h-10 rounded bg-slate-100" />
      ))}
    </div>
  );
}
