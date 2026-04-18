import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiClock, FiMapPin, FiSearch, FiShoppingBag, FiTruck } from "react-icons/fi";
import axios from "../utils/axios";
import { extractList } from "../utils/apiShape";
import PageState from "../components/PageState";

const formatCurrency = (value) => `TZS ${Number(value || 0).toLocaleString()}`;

const formatDateTime = (value) => {
  if (!value) return "Not available";
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

const getVendorLabel = (order) => {
  const stores = [...new Set((order.items || []).map((item) => item.vendor?.storeName || item.vendor?.name).filter(Boolean))];
  if (!stores.length) return "Marketplace order";
  if (stores.length === 1) return stores[0];
  return `${stores[0]} +${stores.length - 1} more`;
};

const getItemSummary = (order) => {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) return "No items attached";
  const totalUnits = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  return `${items.length} item${items.length === 1 ? "" : "s"} • ${totalUnits} unit${totalUnits === 1 ? "" : "s"}`;
};

const buildSearchIndex = (order) =>
  [
    order._id,
    order.user?.name,
    order.user?.phone,
    order.delivery?.address,
    order.items?.map((item) => item.name).join(" "),
    order.items?.map((item) => item.vendor?.storeName || item.vendor?.name).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export default function RiderHistory() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("30");

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get("/rider/history");
        setOrders(extractList(data, ["orders", "items"]));
        setError("");
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load delivery history");
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rangeDays = Number(range);
    const cutoff = Number.isFinite(rangeDays) ? Date.now() - rangeDays * 24 * 60 * 60 * 1000 : null;

    return orders.filter((order) => {
      const deliveredAt = order.deliveredAt || order.delivery?.completedAt || order.completedAt || order.createdAt;
      if (cutoff && deliveredAt && new Date(deliveredAt).getTime() < cutoff) return false;
      if (!query) return true;
      return buildSearchIndex(order).includes(query);
    });
  }, [orders, range, search]);

  const summary = useMemo(() => {
    const totalValue = filteredOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const stores = new Set(filteredOrders.map((order) => getVendorLabel(order)).filter(Boolean));
    const today = new Date().toDateString();
    const completedToday = filteredOrders.filter((order) => {
      const deliveredAt = order.deliveredAt || order.delivery?.completedAt || order.completedAt;
      return deliveredAt && new Date(deliveredAt).toDateString() === today;
    }).length;

    return {
      deliveries: filteredOrders.length,
      totalValue,
      stores: stores.size,
      completedToday,
    };
  }, [filteredOrders]);

  const analytics = useMemo(() => {
    const dayMap = new Map();
    const storeMap = new Map();

    filteredOrders.forEach((order) => {
      const completedAt = order.deliveredAt || order.delivery?.completedAt || order.completedAt || order.createdAt;
      const stamp = completedAt ? new Date(completedAt) : null;
      const key = stamp ? stamp.toLocaleDateString([], { month: "short", day: "numeric" }) : "Unknown";
      const dayEntry = dayMap.get(key) || { label: key, deliveries: 0, value: 0, timestamp: stamp ? stamp.getTime() : 0 };
      dayEntry.deliveries += 1;
      dayEntry.value += Number(order.totalAmount || 0);
      dayMap.set(key, dayEntry);

      const store = getVendorLabel(order);
      const storeEntry = storeMap.get(store) || { store, deliveries: 0, value: 0 };
      storeEntry.deliveries += 1;
      storeEntry.value += Number(order.totalAmount || 0);
      storeMap.set(store, storeEntry);
    });

    const recentDays = [...dayMap.values()]
      .sort((left, right) => left.timestamp - right.timestamp)
      .slice(-7);
    const maxDeliveries = Math.max(...recentDays.map((entry) => entry.deliveries), 1);
    const topStores = [...storeMap.values()].sort((left, right) => right.deliveries - left.deliveries).slice(0, 4);

    return {
      recentDays,
      maxDeliveries,
      topStores,
    };
  }, [filteredOrders]);

  if (loading) {
    return <PageState title="Loading delivery history" description="Collecting your completed delivery record..." />;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="rounded-[28px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_48%,#ffedd5_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Completed Deliveries</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 md:text-3xl">Rider History</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
              Review completed orders, track how much value you have moved, and see which stores and drop-off routes are filling your delivery day.
            </p>
          </div>
        </div>
      </section>

      {error ? <PageState tone="error" title="History unavailable" description={error} /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HistoryMetric label="Completed deliveries" value={summary.deliveries} tone="navy" />
        <HistoryMetric label="Delivery value" value={formatCurrency(summary.totalValue)} tone="orange" />
        <HistoryMetric label="Stores served" value={summary.stores} tone="slate" />
        <HistoryMetric label="Completed today" value={summary.completedToday} tone="emerald" />
      </section>

      {!!filteredOrders.length ? (
        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="surface-panel-lg p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Last 7 delivery days</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Performance Trend</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[#102A43]">
                {summary.deliveries} completed
              </span>
            </div>

            <div className="mt-6 grid grid-cols-7 gap-3">
              {analytics.recentDays.map((entry) => (
                <div key={entry.label} className="flex min-h-[220px] flex-col justify-end gap-3">
                  <div className="flex flex-1 items-end">
                    <div
                      className="w-full rounded-t-[20px] bg-[linear-gradient(180deg,#102A43_0%,#1d4b78_68%,#F28C28_100%)] shadow-[0_18px_34px_rgba(16,42,67,0.16)]"
                      style={{ height: `${Math.max((entry.deliveries / analytics.maxDeliveries) * 100, 16)}%` }}
                    />
                  </div>
                  <div className="space-y-1 text-center">
                    <p className="text-sm font-black text-slate-900">{entry.deliveries}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{entry.label}</p>
                    <p className="text-xs text-slate-500">{formatCurrency(entry.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="surface-panel-lg p-5 md:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Store mix</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Top Stores Served</h2>

            <div className="mt-5 space-y-4">
              {analytics.topStores.map((entry) => (
                <div key={entry.store} className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{entry.store}</p>
                      <p className="mt-1 text-sm text-slate-500">{entry.deliveries} completed delivery{entry.deliveries === 1 ? "" : "ies"}</p>
                    </div>
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                      {formatCurrency(entry.value)}
                    </span>
                  </div>
                </div>
              ))}

              {!analytics.topStores.length ? (
                <PageState tone="info" title="No store breakdown yet" description="Completed deliveries will show which stores you are serving the most." />
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      <section className="surface-panel-lg p-5 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_auto] lg:items-end">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Search history</span>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="input pl-11"
                placeholder="Search by customer, address, item, or store"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Time range</span>
            <select value={range} onChange={(event) => setRange(event.target.value)} className="input min-w-[180px]">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 12 months</option>
            </select>
          </label>
        </div>
      </section>

      {!filteredOrders.length ? (
        <PageState
          tone="info"
          title={orders.length ? "No deliveries match this view" : "No completed deliveries yet"}
          description={
            orders.length
              ? "Try a wider date range or clear the search term."
              : "As soon as you complete deliveries, they will appear here with store and customer context."
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const completedAt = order.deliveredAt || order.delivery?.completedAt || order.completedAt;
            return (
              <article key={order._id} className="surface-panel-lg p-5 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-slate-900">Order #{String(order._id).slice(-6)}</h2>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Delivered
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[#102A43]">
                        {getVendorLabel(order)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-600">
                      {order.user?.name || "Unknown customer"} • {getItemSummary(order)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{order.delivery?.address || "Pickup order"}</p>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <p className="font-semibold text-slate-900">{formatCurrency(order.totalAmount)}</p>
                    <p className="mt-1">{formatDateTime(completedAt)}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <HistoryDetail icon={FiTruck} label="Store" value={getVendorLabel(order)} subvalue={order.items?.find((item) => item.vendor?.businessPhone)?.vendor?.businessPhone || "No store phone"} />
                  <HistoryDetail icon={FiShoppingBag} label="Basket" value={getItemSummary(order)} subvalue={formatCurrency(order.totalAmount)} />
                  <HistoryDetail icon={FiMapPin} label="Drop-off" value={order.delivery?.address || "Pickup order"} subvalue={order.user?.phone || order.delivery?.contactPhone || "No contact phone"} />
                  <HistoryDetail icon={FiCalendar} label="Completed" value={formatDateTime(completedAt)} subvalue={`Assigned ${formatDateTime(order.delivery?.assignedAt)}`} />
                </div>

                {order.delivery?.proofRecipient || order.delivery?.proofNote ? (
                  <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Delivery proof</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Received by</p>
                        <p className="mt-1 font-semibold text-slate-900">{order.delivery?.proofRecipient || "Not recorded"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Rider note</p>
                        <p className="mt-1 text-sm text-slate-600">{order.delivery?.proofNote || "No delivery note left"}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-2">
                  {(order.items || []).map((item) => (
                    <span key={item._id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                      {item.name} x{item.qty}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HistoryMetric({ label, value, tone = "slate" }) {
  const toneMap = {
    navy: "bg-[#102A43]/5 text-[#102A43]",
    orange: "bg-orange-50 text-orange-700",
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };

  return (
    <article className="surface-panel p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <div className={`mt-4 inline-flex rounded-2xl px-3 py-2 text-2xl font-black ${toneMap[tone] || toneMap.slate}`}>
        {value}
      </div>
    </article>
  );
}

function HistoryDetail({ icon: Icon, label, value, subvalue }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        <Icon className="text-sm" />
        {label}
      </div>
      <p className="mt-2 font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{subvalue}</p>
    </div>
  );
}
