import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiMapPin, FiPhone, FiRefreshCw, FiShoppingBag, FiTruck } from "react-icons/fi";
import axios from "../utils/axios";
import { extractList } from "../utils/apiShape";
import PageState from "../components/PageState";
import useToast from "../hooks/useToast";

const AUTO_REFRESH_INTERVAL = 15000;
const SLA_SECONDS = 120;

const formatCurrency = (value) => `TZS ${Number(value || 0).toLocaleString()}`;

const formatTime = (value, options = {}) => {
  if (!value) return "Not available";

  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  });
};

const getOrderSecondsLeft = (order, now) => {
  const assignedAt = order?.delivery?.assignedAt;
  if (!assignedAt) return null;

  const elapsed = Math.floor((now - new Date(assignedAt).getTime()) / 1000);
  return Math.max(SLA_SECONDS - elapsed, 0);
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

export default function RiderDashboard() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  const fetchRiderOrders = async (showToast = false) => {
    try {
      if (!orders.length) {
        setLoading(true);
      }

      const { data } = await axios.get("/rider/orders");
      const ordersList = extractList(data, ["orders", "items"]);
      setOrders(ordersList.filter((order) => order.status === "out_for_delivery"));
      setError("");

      if (showToast) {
        toast.success("Delivery board refreshed");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to fetch deliveries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiderOrders();
    const refresh = setInterval(() => fetchRiderOrders(), AUTO_REFRESH_INTERVAL);
    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  const dashboard = useMemo(() => {
    const accepted = orders.filter((order) => Boolean(order.delivery?.acceptedAt));
    const awaitingAcceptance = orders.filter((order) => !order.delivery?.acceptedAt);
    const urgent = awaitingAcceptance.filter((order) => {
      const secondsLeft = getOrderSecondsLeft(order, now);
      return secondsLeft !== null && secondsLeft <= 30;
    });

    const totalValue = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const topPriority = [...orders].sort((left, right) => {
      const leftAccepted = Boolean(left.delivery?.acceptedAt);
      const rightAccepted = Boolean(right.delivery?.acceptedAt);
      if (leftAccepted !== rightAccepted) return leftAccepted ? 1 : -1;
      return (getOrderSecondsLeft(left, now) ?? Infinity) - (getOrderSecondsLeft(right, now) ?? Infinity);
    })[0] || null;

    return {
      accepted,
      awaitingAcceptance,
      urgent,
      totalValue,
      topPriority,
    };
  }, [now, orders]);

  const markDelivered = async (orderId) => {
    try {
      setUpdatingId(orderId);
      await axios.put(`/rider/orders/${orderId}/delivered`);
      toast.success("Delivery marked as complete");
      fetchRiderOrders();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to mark delivered");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <PageState title="Loading rider workspace" description="Preparing your active delivery board..." />;
  }

  const priority = dashboard.topPriority;
  const prioritySecondsLeft = priority ? getOrderSecondsLeft(priority, now) : null;

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="rounded-[28px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#dbeafe_0%,#ffffff_44%,#ffedd5_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Rider Command</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 md:text-3xl">Delivery Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
              Stay ahead of acceptance timers, keep customers informed, and close deliveries without losing the next assignment window.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Live Orders</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{orders.length}</p>
            </article>
            <article className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Awaiting Reply</p>
              <p className="mt-2 text-2xl font-black text-orange-700">{dashboard.awaitingAcceptance.length}</p>
            </article>
            <article className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Delivery Value</p>
              <p className="mt-2 text-xl font-black text-[#102A43]">{formatCurrency(dashboard.totalValue)}</p>
            </article>
          </div>
        </div>
      </section>

      {error ? <PageState tone="error" title="Deliveries unavailable" description={error} /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={FiClock}
          label="Waiting for acceptance"
          value={dashboard.awaitingAcceptance.length}
          description="Orders that still need your response."
          tone="orange"
        />
        <MetricCard
          icon={FiTruck}
          label="Accepted on the road"
          value={dashboard.accepted.length}
          description="Orders you have already taken over."
          tone="navy"
        />
        <MetricCard
          icon={FiCheckCircle}
          label="Urgent timers"
          value={dashboard.urgent.length}
          description="Orders with 30 seconds or less left."
          tone="red"
        />
        <MetricCard
          icon={FiShoppingBag}
          label="Average basket"
          value={orders.length ? formatCurrency(Math.round(dashboard.totalValue / orders.length)) : "TZS 0"}
          description="Average order value in your current queue."
          tone="slate"
        />
      </section>

      {priority ? (
        <section className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
          <article className="surface-panel-lg p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Top Priority</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Order #{String(priority._id).slice(-6)}</h2>
                <p className="mt-2 text-sm text-slate-500">
                  {getVendorLabel(priority)} • {getItemSummary(priority)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${priority.delivery?.acceptedAt ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
                  {priority.delivery?.acceptedAt ? "Accepted" : "Needs response"}
                </span>
                {prioritySecondsLeft !== null && !priority.delivery?.acceptedAt ? (
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${prioritySecondsLeft <= 30 ? "bg-red-100 text-red-700" : "bg-slate-100 text-[#102A43]"}`}>
                    {prioritySecondsLeft}s left
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <InfoRow icon={FiPhone} label="Customer" value={priority.user?.name || "Unknown"} subvalue={priority.delivery?.contactPhone || priority.user?.phone || "No contact phone"} />
              <InfoRow icon={FiMapPin} label="Drop-off" value={priority.delivery?.address || "Pickup order"} subvalue={`Assigned ${formatTime(priority.delivery?.assignedAt, { dateStyle: undefined })}`} />
              <InfoRow icon={FiShoppingBag} label="Basket" value={formatCurrency(priority.totalAmount)} subvalue={getItemSummary(priority)} />
              <InfoRow icon={FiTruck} label="Store" value={getVendorLabel(priority)} subvalue={priority.items?.[0]?.vendor?.businessPhone || "No store phone"} />
            </div>

            <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Order notes</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(priority.items || []).slice(0, 4).map((item) => (
                  <span key={item._id} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    {item.name} x{item.qty}
                  </span>
                ))}
                {!priority.items?.length ? (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                    Item details unavailable
                  </span>
                ) : null}
              </div>
            </div>

            {priority.delivery?.acceptedAt ? (
              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => markDelivered(priority._id)}
                  disabled={updatingId === priority._id}
                  className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-60"
                >
                  <FiCheckCircle />
                  {updatingId === priority._id ? "Saving..." : "Mark as Delivered"}
                </button>
              </div>
            ) : null}
          </article>

          <article className="surface-panel-lg p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Shift Health</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Quick Read</h2>
              </div>
              <button type="button" onClick={() => fetchRiderOrders(true)} className="btn-soft inline-flex items-center gap-2 px-4 py-2 text-sm">
                <FiRefreshCw />
                Refresh
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <InsightStrip
                label="Next best move"
                value={dashboard.awaitingAcceptance.length ? "Respond to waiting orders first" : "Close accepted deliveries"}
                description={dashboard.awaitingAcceptance.length ? "Keep the timer from handing the order to another rider." : "Completing deliveries quickly opens up the next assignment."}
                tone="orange"
              />
              <InsightStrip
                label="Customer pressure"
                value={dashboard.urgent.length ? `${dashboard.urgent.length} urgent order${dashboard.urgent.length === 1 ? "" : "s"}` : "No urgent timers"}
                description="Orders under 30 seconds should be addressed immediately."
                tone={dashboard.urgent.length ? "red" : "navy"}
              />
              <InsightStrip
                label="Delivery board"
                value={orders.length ? `${orders.length} live order${orders.length === 1 ? "" : "s"}` : "No open deliveries"}
                description="Your dashboard refreshes automatically every 15 seconds."
                tone="slate"
              />
            </div>
          </article>
        </section>
      ) : (
        <PageState tone="info" title="No live deliveries right now" description="When a paid order is assigned to you, it will appear here with customer, address, and store details." />
      )}

      {!!orders.length ? (
        <section className="surface-panel-wrap">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Live Queue</p>
              <h2 className="mt-1 text-lg font-black text-slate-900">Assigned Deliveries</h2>
            </div>
            <p className="text-sm text-slate-500">Most urgent orders appear first.</p>
          </div>

          <div className="divide-y divide-slate-200/70">
            {[...orders]
              .sort((left, right) => (getOrderSecondsLeft(left, now) ?? Infinity) - (getOrderSecondsLeft(right, now) ?? Infinity))
              .map((order) => {
                const secondsLeft = getOrderSecondsLeft(order, now);
                const accepted = Boolean(order.delivery?.acceptedAt);

                return (
                  <article key={order._id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.2fr_0.8fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-900">Order #{String(order._id).slice(-6)}</p>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${accepted ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
                          {accepted ? "Accepted" : "Waiting"}
                        </span>
                        {secondsLeft !== null && !accepted ? (
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${secondsLeft <= 30 ? "bg-red-100 text-red-700" : "bg-slate-100 text-[#102A43]"}`}>
                            {secondsLeft}s left
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {order.user?.name || "Unknown"} • {getVendorLabel(order)} • {getItemSummary(order)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{order.delivery?.address || "Pickup order"}</p>
                    </div>

                    <div className="text-sm text-slate-600">
                      <p className="font-semibold text-slate-900">{formatCurrency(order.totalAmount)}</p>
                      <p className="mt-1">{order.delivery?.contactPhone || order.user?.phone || "No contact phone"}</p>
                      <p className="mt-1">{formatTime(order.createdAt, { dateStyle: undefined })}</p>
                    </div>

                    <div className="flex justify-start lg:justify-end">
                      {accepted ? (
                        <button
                          onClick={() => markDelivered(order._id)}
                          disabled={updatingId === order._id}
                          className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
                        >
                          <FiCheckCircle />
                          {updatingId === order._id ? "Saving..." : "Delivered"}
                        </button>
                      ) : (
                        <span className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-500">
                          Accept from Orders page
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, description, tone = "slate" }) {
  const toneMap = {
    navy: "bg-[#102A43]/5 text-[#102A43]",
    orange: "bg-orange-50 text-orange-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <article className="surface-panel p-5">
      <div className={`grid h-11 w-11 place-items-center rounded-2xl ${toneMap[tone] || toneMap.slate}`}>
        <Icon />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </article>
  );
}

function InfoRow({ icon: Icon, label, value, subvalue }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        <Icon className="text-sm" />
        {label}
      </div>
      <p className="mt-2 font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{subvalue}</p>
    </div>
  );
}

function InsightStrip({ label, value, description, tone = "slate" }) {
  const toneMap = {
    navy: "border-[#102A43]/10 bg-[#102A43]/5",
    orange: "border-orange-200 bg-orange-50",
    red: "border-red-200 bg-red-50",
    slate: "border-slate-200 bg-slate-50",
  };

  return (
    <div className={`rounded-[24px] border p-4 ${toneMap[tone] || toneMap.slate}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-base font-black text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}
