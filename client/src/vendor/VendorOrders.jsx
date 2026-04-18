import { useEffect, useMemo, useState } from "react";
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
import { getOrderStatusTone, getPayoutStatusLabel, getPayoutStatusTone } from "../utils/statusStyles";

const formatCurrency = (value) => `Tsh ${Number(value || 0).toLocaleString()}`;

export default function VendorOrders() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payoutFilter, setPayoutFilter] = useState("all");
  const [pageSize, setPageSize] = useState(6);
  const [currentPage, setCurrentPage] = useState(1);
  const [issueBusyId, setIssueBusyId] = useState(null);
  const [issueDrafts, setIssueDrafts] = useState({});
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

  const filteredOrders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      if (normalizedQuery) {
        const searchableText = [
          order._id,
          order.user?.name,
          order.delivery?.address,
          order.delivery?.contactPhone,
          order.delivery?.proofRecipient,
          order.delivery?.proofNote,
          order.delivery?.issueReason,
          order.delivery?.issueStatus,
          order.delivery?.issueResolutionNote,
          order.payment?.reference,
          order.payment?.provider,
          ...(order.items || []).flatMap((item) => [item.name, item.sku]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(normalizedQuery)) {
          return false;
        }
      }

      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false;
      }

      if (payoutFilter !== "all" && order.vendorSummary?.payoutStatus !== payoutFilter) {
        return false;
      }

      return true;
    });
  }, [orders, payoutFilter, searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, payoutFilter, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredOrders, pageSize]);

  const paginationLabel = useMemo(() => {
    if (!filteredOrders.length) {
      return "Showing 0 results";
    }

    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, filteredOrders.length);
    return `Showing ${start}-${end} of ${filteredOrders.length}`;
  }, [currentPage, filteredOrders.length, pageSize]);

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
      setError(err.response?.data?.message || "Failed to update delivery issue.");
    } finally {
      setIssueBusyId(null);
    }
  };

  if (loading) {
    return <PageState title="Loading orders" description="Collecting your latest order activity..." />;
  }

  if (error) {
    return <PageState tone="error" title="Orders unavailable" description={error} />;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="rounded-[28px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_48%,#fff7ed_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Sales Orders</p>
        <h1 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">Orders for your products</h1>
        <p className="mt-2 text-slate-500">Track your sales, see order-line totals, and understand what is ready to become vendor payout.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Orders", value: summary.totalOrders, icon: FiShoppingBag, tone: "text-slate-900", accent: "bg-slate-100 text-slate-700" },
          { label: "Gross Sales", value: formatCurrency(summary.totalRevenue), icon: FiCreditCard, tone: "text-[#102A43]", accent: "bg-slate-100 text-[#102A43]" },
          { label: "Projected Payout", value: formatCurrency(summary.projectedPayout), icon: FiCheckCircle, tone: "text-orange-700", accent: "bg-orange-100 text-orange-600" },
          { label: "Awaiting Payment", value: summary.awaitingPayment, icon: FiClock, tone: "text-amber-700", accent: "bg-amber-100 text-amber-600" },
          { label: "Ready for Payout", value: summary.readyForPayoutOrders, icon: FiTruck, tone: "text-orange-700", accent: "bg-orange-100 text-orange-600" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.label}
              className="surface-panel p-5"
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

      <section className="surface-panel-lg p-5 md:p-6">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <label className="block md:col-span-3 xl:col-span-4">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Search orders</span>
            <input
              className="input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by order, customer, phone, reference, or item"
            />
            <p className="mt-2 text-xs text-slate-500">{paginationLabel} from {orders.length} total orders</p>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Order status</span>
            <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="out_for_delivery">Out for delivery</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Payout stage</span>
            <select className="input" value={payoutFilter} onChange={(event) => setPayoutFilter(event.target.value)}>
              <option value="all">All payout stages</option>
              <option value="awaiting_payment">Awaiting payment</option>
              <option value="processing">Processing</option>
              <option value="ready_for_payout">Ready for payout</option>
              <option value="on_hold">On hold</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Cards per page</span>
            <select className="input" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) || 6)}>
              <option value={6}>6 cards</option>
              <option value={12}>12 cards</option>
              <option value={24}>24 cards</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-4">
        {paginatedOrders.map((order) => (
          <article
            key={order._id}
            className="rounded-[26px] border border-white/80 bg-white/92 p-5 shadow-[0_18px_38px_rgba(15,23,42,0.06)]"
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-black text-slate-900">Order #{order._id}</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusTone(order.status)}`}>
                    {order.status.replace(/_/g, " ")}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getPayoutStatusTone(order.vendorSummary?.payoutStatus)}`}>
                    {getPayoutStatusLabel(order.vendorSummary?.payoutStatus)}
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
                <div className="rounded-[24px] border border-[#102A43]/10 bg-slate-100/70 px-4 py-3 text-sm shadow-sm">
                  <p className="font-semibold text-slate-900">Gross sales</p>
                  <p className="mt-1 text-2xl font-black text-[#102A43]">
                    {formatCurrency(order.vendorSummary?.subtotal)}
                  </p>
                  <p className="text-slate-500">{order.vendorSummary?.itemCount || 0} item(s)</p>
                </div>
                <div className="rounded-[24px] border border-orange-100 bg-orange-50/70 px-4 py-3 text-sm shadow-sm">
                  <p className="font-semibold text-slate-900">Estimated payout</p>
                  <p className="mt-1 text-2xl font-black text-orange-700">
                    {formatCurrency(order.vendorSummary?.estimatedPayout)}
                  </p>
                  <p className="text-slate-500">{getPayoutStatusLabel(order.vendorSummary?.payoutStatus)}</p>
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
                      <p className="mt-1 font-semibold text-orange-700">{formatCurrency(item.estimatedPayout)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {order.delivery?.proofRecipient || order.delivery?.proofNote ? (
              <div className="mt-4 rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Delivery proof</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      Received by {order.delivery?.proofRecipient || "Not recorded"}
                    </p>
                  </div>
                  {order.deliveredAt ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Delivered {new Date(order.deliveredAt).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {order.delivery?.proofNote || "No delivery note was left for this drop-off."}
                </p>
              </div>
            ) : null}

            {order.delivery?.issueReason ? (
              <div className="mt-4 rounded-[24px] border border-red-200 bg-red-50/75 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Reported delivery issue</p>
                <p className="mt-2 text-sm text-slate-700">{order.delivery.issueReason}</p>
                {order.delivery?.issueReportedAt ? (
                  <p className="mt-2 text-xs font-medium text-red-700">
                    Reported {new Date(order.delivery.issueReportedAt).toLocaleString()}
                  </p>
                ) : null}
                <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr_auto]">
                  <select
                    className="input"
                    value={issueDrafts[String(order._id)]?.status || order.delivery?.issueStatus || "open"}
                    onChange={(event) => updateIssueDraft(order._id, "status", event.target.value)}
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <input
                    className="input"
                    placeholder="Resolution note"
                    value={issueDrafts[String(order._id)]?.resolutionNote || order.delivery?.issueResolutionNote || ""}
                    onChange={(event) => updateIssueDraft(order._id, "resolutionNote", event.target.value)}
                  />
                  <button
                    type="button"
                    disabled={issueBusyId === order._id}
                    onClick={() => saveIssueUpdate(order._id)}
                    className="rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                  >
                    {issueBusyId === order._id ? "Saving..." : "Update issue"}
                  </button>
                </div>
                <p className="mt-3 text-xs font-medium text-slate-500">
                  Current status: {String(order.delivery?.issueStatus || "open").replaceAll("_", " ")}
                  {order.delivery?.issueResolvedAt ? ` • Resolved ${new Date(order.delivery.issueResolvedAt).toLocaleDateString()}` : ""}
                </p>
              </div>
            ) : null}
          </article>
        ))}

        {!filteredOrders.length ? (
          <PageState
            tone="info"
            title="No vendor orders match these filters"
            description="Try a broader search or adjust the order and payout filters."
          />
        ) : null}
      </section>

      {filteredOrders.length > 0 ? (
        <section className="surface-panel-lg flex flex-col gap-3 p-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <p>{paginationLabel}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
            >
              Previous
            </button>
            <span className="rounded-xl bg-slate-100 px-3 py-2 font-semibold text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
            >
              Next
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
