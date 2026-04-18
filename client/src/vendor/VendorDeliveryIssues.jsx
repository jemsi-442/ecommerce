import { useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiClock, FiMapPin, FiPhone, FiTruck } from "react-icons/fi";
import PageState from "../components/PageState";
import axios from "../utils/axios";
import { extractList } from "../utils/apiShape";
import { PLACEHOLDER_IMAGE, resolveImageUrl } from "../utils/image";

const formatCurrency = (value) => `Tsh ${Number(value || 0).toLocaleString()}`;

const formatDateTime = (value) => {
  if (!value) return "Not available";
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

const issueToneMap = {
  open: "border-red-200 bg-red-50 text-red-700",
  investigating: "border-orange-200 bg-orange-50 text-orange-700",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export default function VendorDeliveryIssues() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [issueBusyId, setIssueBusyId] = useState(null);
  const [issueDrafts, setIssueDrafts] = useState({});

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get("/vendor/orders");
      setOrders(extractList(data, ["orders", "items"]));
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load delivery issues.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const issueOrders = useMemo(() => orders.filter((order) => Boolean(order.delivery?.issueReason)), [orders]);

  const summary = useMemo(() => {
    const open = issueOrders.filter((order) => !order.delivery?.issueStatus || order.delivery?.issueStatus === "open").length;
    const investigating = issueOrders.filter((order) => order.delivery?.issueStatus === "investigating").length;
    const resolved = issueOrders.filter((order) => order.delivery?.issueStatus === "resolved").length;

    return {
      total: issueOrders.length,
      open,
      investigating,
      resolved,
    };
  }, [issueOrders]);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return issueOrders.filter((order) => {
      if (statusFilter === "open") {
        if (order.delivery?.issueStatus && order.delivery.issueStatus !== "open") return false;
      } else if (statusFilter !== "all" && order.delivery?.issueStatus !== statusFilter) {
        return false;
      }

      if (!query) return true;

      const searchable = [
        order._id,
        order.user?.name,
        order.user?.email,
        order.delivery?.contactPhone,
        order.delivery?.address,
        order.delivery?.proofRecipient,
        order.delivery?.proofNote,
        order.delivery?.issueReason,
        order.delivery?.issueResolutionNote,
        order.delivery?.rider?.name,
        ...(order.items || []).map((item) => item.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [issueOrders, searchQuery, statusFilter]);

  const updateIssueDraft = (orderId, field, value) => {
    setIssueDrafts((current) => ({
      ...current,
      [String(orderId)]: {
        status: current[String(orderId)]?.status || "open",
        resolutionNote: current[String(orderId)]?.resolutionNote || "",
        [field]: value,
      },
    }));
  };

  const saveIssueUpdate = async (orderId) => {
    const draft = issueDrafts[String(orderId)] || { status: "open", resolutionNote: "" };
    try {
      setIssueBusyId(orderId);
      await axios.patch(`/vendor/orders/${orderId}/delivery-issue`, draft);
      await fetchOrders();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to update delivery issue.");
    } finally {
      setIssueBusyId(null);
    }
  };

  if (loading) {
    return <PageState title="Loading delivery issues" description="Preparing the support queue for your store..." />;
  }

  if (error) {
    return <PageState tone="error" title="Delivery issues unavailable" description={error} />;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="rounded-[28px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_48%,#fff7ed_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Support Queue</p>
        <h1 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">Delivery Issues</h1>
        <p className="mt-2 text-slate-500">Review customer delivery complaints, check proof, and send a clear update from one workspace.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <IssueMetric label="Reported issues" value={summary.total} tone="slate" icon={FiAlertCircle} />
        <IssueMetric label="Open" value={summary.open} tone="red" icon={FiClock} />
        <IssueMetric label="Investigating" value={summary.investigating} tone="orange" icon={FiTruck} />
        <IssueMetric label="Resolved" value={summary.resolved} tone="emerald" icon={FiCheckCircle} />
      </section>

      <section className="surface-panel-lg p-5 md:p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block md:col-span-2">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Search issue queue</span>
            <input
              className="input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by customer, phone, address, issue note, or item"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Issue status</span>
            <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All reported issues</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Showing {filteredOrders.length} of {issueOrders.length} reported delivery issues
        </p>
      </section>

      {!filteredOrders.length ? (
        <PageState
          tone="info"
          title={issueOrders.length ? "No issues match this view" : "No delivery issues reported"}
          description={issueOrders.length ? "Try a different search term or issue status." : "Reported issues will appear here with delivery proof and resolution tools."}
        />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const currentStatus = order.delivery?.issueStatus || "open";
            const draft = issueDrafts[String(order._id)] || {
              status: currentStatus,
              resolutionNote: order.delivery?.issueResolutionNote || "",
            };

            return (
              <article key={order._id} className="surface-panel-lg p-5 md:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-slate-900">Order #{String(order._id).slice(-6)}</h2>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${issueToneMap[currentStatus] || issueToneMap.open}`}>
                        {String(currentStatus).replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {order.user?.name || "Customer"} • {formatCurrency(order.totalAmount)} • {formatDateTime(order.delivery?.issueReportedAt)}
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <MiniInfo icon={FiPhone} label="Phone" value={order.delivery?.contactPhone || order.user?.phone || "N/A"} />
                    <MiniInfo icon={FiMapPin} label="Address" value={order.delivery?.address || "Pickup order"} />
                    <MiniInfo icon={FiTruck} label="Rider" value={order.delivery?.rider?.name || "Unassigned"} />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.95fr]">
                  <div className="space-y-4">
                    <section className="rounded-[24px] border border-red-100 bg-red-50/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Customer issue</p>
                      <p className="mt-2 text-sm text-slate-700">{order.delivery?.issueReason || "No issue note recorded."}</p>
                    </section>

                    <section className="rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Delivery proof</p>
                      <div className="mt-3 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Received by</p>
                            <p className="mt-1 font-semibold text-slate-900">{order.delivery?.proofRecipient || "Not recorded"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Rider note</p>
                            <p className="mt-1 text-sm text-slate-600">{order.delivery?.proofNote || "No rider note left."}</p>
                          </div>
                        </div>
                        {order.delivery?.proofImage ? (
                          <div className="overflow-hidden rounded-[22px] border border-emerald-200/80 bg-white">
                            <img
                              src={resolveImageUrl(order.delivery.proofImage, PLACEHOLDER_IMAGE)}
                              alt="Delivery proof"
                              className="h-56 w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.src = PLACEHOLDER_IMAGE;
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                    </section>

                    {!!order.items?.length ? (
                      <section className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Items in this order</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {order.items.map((item) => (
                            <span key={`${order._id}-${item.product || item._id}-${item.name}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                              {item.name} x{item.qty}
                            </span>
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </div>

                  <section className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Resolution workspace</p>
                    <div className="mt-4 space-y-3">
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Issue status</span>
                        <select
                          className="input"
                          value={draft.status}
                          onChange={(event) => updateIssueDraft(order._id, "status", event.target.value)}
                        >
                          <option value="open">Open</option>
                          <option value="investigating">Investigating</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Resolution note</span>
                        <textarea
                          className="input min-h-[120px] resize-y py-3"
                          value={draft.resolutionNote}
                          onChange={(event) => updateIssueDraft(order._id, "resolutionNote", event.target.value)}
                          placeholder="Write the customer-facing update for this issue"
                        />
                      </label>

                      <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
                        <p>
                          Current status: <span className="font-semibold text-slate-900">{String(currentStatus).replaceAll("_", " ")}</span>
                        </p>
                        {order.delivery?.issueResolvedAt ? (
                          <p className="mt-2 text-emerald-700">Resolved {formatDateTime(order.delivery.issueResolvedAt)}</p>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => saveIssueUpdate(order._id)}
                        disabled={issueBusyId === order._id}
                        className="btn-primary w-full justify-center disabled:opacity-60"
                      >
                        {issueBusyId === order._id ? "Saving..." : "Save issue update"}
                      </button>
                    </div>
                  </section>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IssueMetric({ label, value, tone, icon: Icon }) {
  const toneMap = {
    slate: "bg-slate-100 text-slate-700",
    red: "bg-red-50 text-red-700",
    orange: "bg-orange-50 text-orange-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };

  return (
    <article className="surface-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
          <p className="mt-3 text-2xl font-black text-slate-900">{value}</p>
        </div>
        <span className={`rounded-2xl p-3 ${toneMap[tone] || toneMap.slate}`}>
          <Icon size={18} />
        </span>
      </div>
    </article>
  );
}

function MiniInfo({ icon: Icon, label, value }) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        <Icon />
        {label}
      </p>
      <p className="mt-2 font-semibold text-slate-900">{value}</p>
    </div>
  );
}
