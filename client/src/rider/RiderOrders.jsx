import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiMapPin, FiPhone, FiSearch, FiShoppingBag, FiTruck, FiXCircle } from "react-icons/fi";
import axios from "../utils/axios";
import { extractList } from "../utils/apiShape";
import PageState from "../components/PageState";
import useToast from "../hooks/useToast";
import { PLACEHOLDER_IMAGE, resolveImageUrl } from "../utils/image";

const AUTO_REFRESH_INTERVAL = 15000;
const SLA_SECONDS = 120;

const formatCurrency = (value) => `TZS ${Number(value || 0).toLocaleString()}`;

const getRemainingSeconds = (assignedAt, now) => {
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
  const units = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  return `${items.length} item${items.length === 1 ? "" : "s"} • ${units} unit${units === 1 ? "" : "s"}`;
};

const buildOrderSearch = (order) =>
  [
    order._id,
    order.user?.name,
    order.user?.phone,
    order.delivery?.contactPhone,
    order.delivery?.address,
    order.items?.map((item) => item.name).join(" "),
    order.items?.map((item) => item.vendor?.storeName || item.vendor?.name).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const RiderOrders = () => {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("all");
  const [now, setNow] = useState(Date.now());
  const [proofDrafts, setProofDrafts] = useState({});

  const fetchOrders = async () => {
    try {
      const { data } = await axios.get("/rider/orders");
      const nextOrders = extractList(data, ["orders", "items"]);
      setOrders(nextOrders);
      setProofDrafts((current) => {
        const next = { ...current };
            nextOrders.forEach((order) => {
          const key = String(order._id);
          if (!next[key]) {
            next[key] = {
              recipientName: order.delivery?.proofRecipient || "",
              deliveryNote: order.delivery?.proofNote || "",
              proofImageFile: null,
              proofImagePreview: order.delivery?.proofImage || "",
            };
          }
        });
        return next;
      });
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const refresh = setInterval(fetchOrders, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...orders]
      .filter((order) => {
        const accepted = Boolean(order.delivery?.acceptedAt);
        if (view === "waiting" && accepted) return false;
        if (view === "accepted" && !accepted) return false;
        if (view === "urgent") {
          const remaining = getRemainingSeconds(order.delivery?.assignedAt, now);
          if (accepted || remaining === null || remaining > 30) return false;
        }
        if (!query) return true;
        return buildOrderSearch(order).includes(query);
      })
      .sort((left, right) => {
        const leftAccepted = Boolean(left.delivery?.acceptedAt);
        const rightAccepted = Boolean(right.delivery?.acceptedAt);
        if (leftAccepted !== rightAccepted) return leftAccepted ? 1 : -1;
        return (getRemainingSeconds(left.delivery?.assignedAt, now) ?? Infinity) - (getRemainingSeconds(right.delivery?.assignedAt, now) ?? Infinity);
      });
  }, [now, orders, search, view]);

  const summary = useMemo(() => {
    const waiting = orders.filter((order) => !order.delivery?.acceptedAt).length;
    const accepted = orders.filter((order) => Boolean(order.delivery?.acceptedAt)).length;
    const urgent = orders.filter((order) => {
      const remaining = getRemainingSeconds(order.delivery?.assignedAt, now);
      return !order.delivery?.acceptedAt && remaining !== null && remaining <= 30;
    }).length;

    return {
      waiting,
      accepted,
      urgent,
    };
  }, [now, orders]);

  const handleAction = async (orderId, action) => {
    const labels = {
      accept: "accept this delivery",
      reject: "reject this delivery",
      delivered: "mark this delivery as completed",
    };

    if (!window.confirm(`Confirm ${labels[action] || action}?`)) return;

    setActionLoading(orderId);
    try {
      const payload =
        action === "delivered"
          ? (() => {
              const draft = proofDrafts[String(orderId)] || {};
              const formData = new FormData();
              formData.append("recipientName", draft.recipientName || "");
              formData.append("deliveryNote", draft.deliveryNote || "");
              if (draft.proofImageFile) {
                formData.append("proofImage", draft.proofImageFile);
              }
              return formData;
            })()
          : undefined;

      await axios.put(`/rider/orders/${orderId}/${action}`, payload, action === "delivered" ? { headers: { "Content-Type": "multipart/form-data" } } : undefined);
      toast.success(
        action === "accept"
          ? "Delivery accepted"
          : action === "reject"
            ? "Delivery rejected"
            : "Delivery marked as completed"
      );
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const updateProofDraft = (orderId, field, value) => {
    setProofDrafts((current) => ({
      ...current,
        [String(orderId)]: {
          recipientName: current[String(orderId)]?.recipientName || "",
          deliveryNote: current[String(orderId)]?.deliveryNote || "",
          proofImageFile: current[String(orderId)]?.proofImageFile || null,
          proofImagePreview: current[String(orderId)]?.proofImagePreview || "",
          [field]: value,
        },
      }));
  };

  const updateProofImage = (orderId, file) => {
    setProofDrafts((current) => ({
      ...current,
      [String(orderId)]: {
        recipientName: current[String(orderId)]?.recipientName || "",
        deliveryNote: current[String(orderId)]?.deliveryNote || "",
        proofImageFile: file || null,
        proofImagePreview: file ? URL.createObjectURL(file) : current[String(orderId)]?.proofImagePreview || "",
      },
    }));
  };

  if (loading) {
    return <PageState title="Loading delivery queue" description="Checking your assigned orders..." />;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="rounded-[28px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_48%,#fff7ed_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Assigned Queue</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 md:text-3xl">Rider Orders</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
              Review every assigned order, respond before the timer runs out, and close deliveries with the customer and store details in one place.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryChip label="Waiting" value={summary.waiting} tone="orange" />
            <SummaryChip label="Accepted" value={summary.accepted} tone="navy" />
            <SummaryChip label="Urgent" value={summary.urgent} tone="red" />
          </div>
        </div>
      </section>

      <section className="surface-panel-lg p-5 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_auto] lg:items-end">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Search deliveries</span>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="input pl-11"
                placeholder="Search by customer, phone, address, item, or store"
              />
            </div>
          </label>

          <div className="grid gap-2 sm:grid-cols-4">
            {[
              { key: "all", label: "All" },
              { key: "waiting", label: "Waiting" },
              { key: "accepted", label: "Accepted" },
              { key: "urgent", label: "Urgent" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setView(item.key)}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  view === item.key
                    ? "border-[#102A43]/20 bg-[#102A43] text-white shadow-[0_16px_28px_rgba(16,42,67,0.18)]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:bg-orange-50/50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <p>
            Showing <span className="font-semibold text-slate-700">{filteredOrders.length}</span> of{" "}
            <span className="font-semibold text-slate-700">{orders.length}</span> assigned orders
          </p>
          <p>Queue refreshes automatically every 15 seconds.</p>
        </div>
      </section>

      {!filteredOrders.length ? (
        <PageState
          tone="info"
          title={orders.length ? "No deliveries match your filters" : "No active deliveries"}
          description={
            orders.length
              ? "Try changing the search term or switch back to All deliveries."
              : "New deliveries will appear here as soon as they are assigned to you."
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const accepted = Boolean(order.delivery?.acceptedAt);
            const assignedAt = order.delivery?.assignedAt;
            const remaining = getRemainingSeconds(assignedAt, now);
            const percent = remaining !== null ? Math.round((remaining / SLA_SECONDS) * 100) : 100;
            const danger = remaining !== null && remaining <= 20;
            const storePhone = order.items?.find((item) => item.vendor?.businessPhone)?.vendor?.businessPhone;
            const proof = proofDrafts[String(order._id)] || { recipientName: "", deliveryNote: "", proofImageFile: null, proofImagePreview: "" };

            return (
              <article key={order._id} className="surface-panel-lg p-5 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-slate-900">Order #{String(order._id).slice(-6)}</h2>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${accepted ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
                        {accepted ? "Accepted" : "Waiting for response"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[#102A43]">
                        {getVendorLabel(order)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-600">
                      {getItemSummary(order)} • {formatCurrency(order.totalAmount)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{assignedAt ? `Assigned ${new Date(assignedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Assignment time unavailable"}</p>
                  </div>

                  {!accepted && remaining !== null ? <RadialTimer percent={percent} danger={danger} remaining={remaining} /> : null}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <DetailCard icon={FiPhone} label="Customer" value={order.user?.name || "Unknown"} subvalue={order.delivery?.contactPhone || order.user?.phone || "No phone available"} />
                  <DetailCard icon={FiMapPin} label="Drop-off" value={order.delivery?.address || "Pickup order"} subvalue="Use this address to complete the handoff." />
                  <DetailCard icon={FiShoppingBag} label="Items" value={getItemSummary(order)} subvalue={(order.items || []).slice(0, 2).map((item) => item.name).filter(Boolean).join(" • ") || "Item list unavailable"} />
                  <DetailCard icon={FiTruck} label="Store contact" value={getVendorLabel(order)} subvalue={storePhone || "No store phone on file"} />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {(order.items || []).map((item) => (
                    <span key={item._id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                      {item.name} x{item.qty}
                    </span>
                  ))}
                </div>

                {!accepted ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={() => handleAction(order._id, "accept")}
                      disabled={remaining === 0 || actionLoading === order._id}
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition ${
                        remaining === 0
                          ? "cursor-not-allowed bg-slate-400"
                          : "bg-[linear-gradient(135deg,#102A43_0%,#081B2E_100%)] shadow-[0_16px_30px_rgba(16,42,67,0.2)] hover:brightness-110"
                      } disabled:opacity-60`}
                    >
                      <FiCheckCircle />
                      {actionLoading === order._id ? "Saving..." : "Accept Delivery"}
                    </button>

                    <button
                      onClick={() => handleAction(order._id, "reject")}
                      disabled={actionLoading === order._id}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      <FiXCircle />
                      {actionLoading === order._id ? "Saving..." : "Reject Delivery"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Delivery proof</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <input
                          value={proof.recipientName}
                          onChange={(event) => updateProofDraft(order._id, "recipientName", event.target.value)}
                          className="input"
                          placeholder="Received by"
                        />
                        <input
                          value={proof.deliveryNote}
                          onChange={(event) => updateProofDraft(order._id, "deliveryNote", event.target.value)}
                          className="input"
                          placeholder="Short delivery note"
                        />
                      </div>
                      <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Proof photo</p>
                            <p className="mt-1 text-sm text-slate-500">Add a handoff photo when available so support and store teams can verify delivery faster.</p>
                          </div>
                          <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50/60">
                            Choose photo
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={(event) => updateProofImage(order._id, event.target.files?.[0] || null)}
                            />
                          </label>
                        </div>
                        {proof.proofImagePreview ? (
                          <div className="mt-4 overflow-hidden rounded-[22px] border border-slate-200 bg-slate-100">
                            <img
                              src={resolveImageUrl(proof.proofImagePreview, PLACEHOLDER_IMAGE)}
                              alt="Delivery proof preview"
                              className="h-48 w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.src = PLACEHOLDER_IMAGE;
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => handleAction(order._id, "delivered")}
                        disabled={actionLoading === order._id}
                        className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-60"
                      >
                        <FiCheckCircle />
                        {actionLoading === order._id ? "Saving..." : "Mark Delivered"}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RiderOrders;

const SummaryChip = ({ label, value, tone }) => {
  const toneMap = {
    navy: "border-[#102A43]/10 bg-white/80 text-[#102A43]",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    red: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <article className={`rounded-2xl border px-4 py-3 shadow-sm ${toneMap[tone] || toneMap.navy}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </article>
  );
};

const DetailCard = ({ icon: Icon, label, value, subvalue }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
      <Icon className="text-sm" />
      {label}
    </div>
    <p className="mt-2 font-semibold text-slate-900">{value}</p>
    <p className="mt-1 text-sm text-slate-500">{subvalue}</p>
  </div>
);

const RadialTimer = ({ percent, remaining, danger }) => {
  const stroke = 5;
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="grid place-items-center rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        <FiClock />
        Response timer
      </div>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={radius} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          stroke={danger ? "#dc2626" : "#f28c28"}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
        <text x="32" y="29" textAnchor="middle" fontSize="14" fontWeight="700" fill={danger ? "#dc2626" : "#f28c28"}>
          {remaining}
        </text>
        <text x="32" y="43" textAnchor="middle" fontSize="10" fontWeight="600" fill="#64748b">
          sec
        </text>
      </svg>
    </div>
  );
};
