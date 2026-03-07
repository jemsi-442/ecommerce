const statusClass = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-blue-50 text-blue-700 border-blue-200",
  out_for_delivery: "bg-indigo-50 text-indigo-700 border-indigo-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  refunded: "bg-purple-50 text-purple-700 border-purple-200",
};

export default function OrderCard({ order }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const label = String(order.status || "pending").replaceAll("_", " ");

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm hover:shadow-lg transition">
      <div className="flex justify-between items-start gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Order</p>
          <h3 className="font-black text-slate-900">#{String(order._id).slice(-6)}</h3>
        </div>

        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusClass[order.status] || "bg-slate-50 text-slate-700 border-slate-200"}`}>
          {label}
        </span>
      </div>

      <p className="mt-3 text-sm text-slate-500">{order.delivery?.address || "Pickup"}</p>

      <div className="mt-3 space-y-1 text-sm text-slate-700">
        {items.map((item, i) => (
          <p key={`${item.product}-${i}`}>
            {item.name || "Item"} x {item.qty}
          </p>
        ))}
      </div>

      <p className="mt-4 text-base font-black text-rose-600">
        Jumla: TZS {Number(order.totalAmount || 0).toLocaleString()}
      </p>
    </article>
  );
}
