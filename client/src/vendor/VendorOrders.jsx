import { useEffect, useState } from "react";
import {
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiMapPin,
  FiPhone,
  FiShoppingBag,
  FiTruck,
} from "react-icons/fi";
import PageState from "../components/PageState";
import axios from "../utils/axios";
import { extractList, extractOne } from "../utils/apiShape";
import { PLACEHOLDER_IMAGE, resolveImageUrl } from "../utils/image";

const formatCurrency = (value) => `Tsh ${Number(value || 0).toLocaleString()}`;

const payoutTone = {
  awaiting_payment: "bg-amber-100 text-amber-700",
  processing: "bg-sky-100 text-sky-700",
  ready_for_payout: "bg-emerald-100 text-emerald-700",
  on_hold: "bg-rose-100 text-rose-700",
};

const payoutLabel = {
  awaiting_payment: "Awaiting Payment",
  processing: "Processing",
  ready_for_payout: "Ready for Payout",
  on_hold: "On Hold",
};

const orderTone = (status) => {
  if (status === "delivered") return "bg-emerald-100 text-emerald-700";
  if (status === "paid" || status === "out_for_delivery") return "bg-sky-100 text-sky-700";
  if (status === "cancelled" || status === "refunded") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
};

export default function VendorOrders() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    projectedPayout: 0,
    awaitingPayment: 0,
    processingOrders: 0,
    readyForPayoutOrders: 0,
  });

  useEffect(() => {
    const loadOrders = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get("/vendor/orders");
        setOrders(extractList(data, ["orders", "items"]));
        setSummary(
          extractOne(data)?.summary || {
            totalOrders: 0,
            totalRevenue: 0,
            projectedPayout: 0,
            awaitingPayment: 0,
            processingOrders: 0,
            readyForPayoutOrders: 0,
          }
        );
        setError("");
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load vendor orders.");
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, []);

  if (loading) {
    return <PageState title="Loading orders" description="Collecting your latest order activity..." />;
  }

  if (error) {
    return <PageState tone="error" title="Orders unavailable" description={error} />;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="rounded-[28px] border border-amber-100 bg-[linear-gradient(135deg,#fffaf0_0%,#ffffff_48%,#f8fafc_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-500">Sales Orders</p>
        <h1 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">Orders for your products</h1>
        <p className="mt-2 text-slate-500">Track your sales, see order-line totals, and understand what is ready to become vendor payout.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Orders", value: summary.totalOrders, icon: FiShoppingBag, tone: "text-slate-900", accent: "bg-slate-100 text-slate-700" },
          { label: "Gross Sales", value: formatCurrency(summary.totalRevenue), icon: FiCreditCard, tone: "text-emerald-700", accent: "bg-emerald-100 text-emerald-600" },
          { label: "Projected Payout", value: formatCurrency(summary.projectedPayout), icon: FiCheckCircle, tone: "text-sky-700", accent: "bg-sky-100 text-sky-600" },
          { label: "Awaiting Payment", value: summary.awaitingPayment, icon: FiClock, tone: "text-amber-700", accent: "bg-amber-100 text-amber-600" },
          { label: "Ready for Payout", value: summary.readyForPayoutOrders, icon: FiTruck, tone: "text-violet-700", accent: "bg-violet-100 text-violet-600" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.label}
              className="rounded-[24px] border border-white/80 bg-white/92 p-5 shadow-[0_18px_38px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                  <p className={`mt-3 text-2xl font-black ${item.tone}`}>{item.value}</p>
                </div>
                <span className={`rounded-2xl p-3 ${item.accent}`}>
                  <Icon size={18} />
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="space-y-4">
        {orders.map((order) => (
          <article
            key={order._id}
            className="rounded-[26px] border border-white/80 bg-white/92 p-5 shadow-[0_18px_38px_rgba(15,23,42,0.06)]"
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-black text-slate-900">Order #{order._id}</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${orderTone(order.status)}`}>
                    {order.status.replace(/_/g, " ")}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${payoutTone[order.vendorSummary?.payoutStatus] || payoutTone.processing}`}>
                    {payoutLabel[order.vendorSummary?.payoutStatus] || "Processing"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Customer: <span className="font-semibold text-slate-700">{order.user?.name || "Customer"}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                  {order.delivery?.address ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                      <FiMapPin /> {order.delivery.address}
                    </span>
                  ) : null}
                  {order.delivery?.contactPhone ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                      <FiPhone /> {order.delivery.contactPhone}
                    </span>
                  ) : null}
                  {order.payment?.provider ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                      <FiCreditCard /> {order.payment.provider.replace(/_/g, " ")}
                    </span>
                  ) : null}
                  {order.payment?.reference ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                      Ref {order.payment.reference}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
                <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm shadow-sm">
                  <p className="font-semibold text-slate-900">Gross sales</p>
                  <p className="mt-1 text-2xl font-black text-emerald-700">
                    {formatCurrency(order.vendorSummary?.subtotal)}
                  </p>
                  <p className="text-slate-500">{order.vendorSummary?.itemCount || 0} item(s)</p>
                </div>
                <div className="rounded-[24px] border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm shadow-sm">
                  <p className="font-semibold text-slate-900">Estimated payout</p>
                  <p className="mt-1 text-2xl font-black text-sky-700">
                    {formatCurrency(order.vendorSummary?.estimatedPayout)}
                  </p>
                  <p className="text-slate-500">{payoutLabel[order.vendorSummary?.payoutStatus] || "Processing"}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {order.items.map((item) => (
                <div
                  key={`${order._id}-${item.product}`}
                  className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={resolveImageUrl(item.image, PLACEHOLDER_IMAGE)}
                      alt={item.name}
                      onError={(event) => {
                        event.currentTarget.src = PLACEHOLDER_IMAGE;
                      }}
                      className="h-14 w-14 rounded-2xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Qty {item.qty} • {formatCurrency(item.price)} each
                      </p>
                      {item.sku ? <p className="mt-1 text-xs font-mono text-slate-400">{item.sku}</p> : null}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Line Total</p>
                      <p className="mt-1 font-semibold text-slate-900">{formatCurrency(item.lineTotal)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Payout Est.</p>
                      <p className="mt-1 font-semibold text-sky-700">{formatCurrency(item.estimatedPayout)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}

        {!orders.length ? (
          <PageState
            tone="info"
            title="No vendor orders yet"
            description="Orders will appear here as soon as customers buy your approved products."
          />
        ) : null}
      </section>
    </div>
  );
}
