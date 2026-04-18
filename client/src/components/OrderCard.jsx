import { useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiMapPin,
  FiPackage,
  FiPhone,
  FiRefreshCw,
  FiStar,
  FiShield,
  FiShoppingBag,
  FiTruck,
} from "react-icons/fi";
import MarketplaceRating from "./MarketplaceRating";
import PaymentNetworkBadge from "./PaymentNetworkBadge";
import {
  MOBILE_PAYMENT_NETWORK_OPTIONS,
  normalizePaymentNetworkProvider,
} from "../utils/paymentNetworkLogo";
import {
  detectMobileNetworkFromPhone,
  getMobileNetworkLabel,
  getMobileNetworkPrefixes,
  validatePhoneForNetwork,
} from "../utils/mobileMoneyNetworks";

const statusClass = {
  pending: "bg-orange-50 text-orange-700 border-orange-200",
  paid: "bg-slate-100 text-[#102A43] border-slate-200",
  out_for_delivery: "bg-slate-100 text-[#102A43] border-[#102A43]/10",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  refunded: "bg-slate-100 text-slate-700 border-slate-200",
};

const orderStatusMeta = {
  pending: {
    title: "Awaiting payment",
    detail: "Complete the mobile money prompt on your phone so we can lock in this order.",
    progress: 0,
    nextTitle: "Finish the payment prompt",
    nextDetail: "Approve the mobile money request on your phone. Once payment is confirmed, we will move this order straight into fulfillment.",
    tone: "border-orange-200 bg-[linear-gradient(135deg,#fffaf0_0%,#fff7ed_100%)]",
  },
  paid: {
    title: "Payment confirmed",
    detail: "We have your payment and your order is now moving through fulfillment.",
    progress: 1,
    nextTitle: "We are preparing your order",
    nextDetail: "Your marketplace order is now queued for packing and delivery assignment. Keep this card nearby for the next movement update.",
    tone: "border-slate-200 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_100%)]",
  },
  out_for_delivery: {
    title: "Out for delivery",
    detail: "Your order is already on the move and getting closer to your address.",
    progress: 2,
    nextTitle: "Delivery is in progress",
    nextDetail: "Keep your phone close. The next update should be delivery completion once the rider reaches your address.",
    tone: "border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_100%)]",
  },
  delivered: {
    title: "Delivered",
    detail: "This order was completed successfully and closed out on your account.",
    progress: 3,
    nextTitle: "Everything is complete",
    nextDetail: "This order has been delivered successfully. You can use this card later for reference, payment proof, or a quick reorder decision.",
    tone: "border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_100%)]",
  },
  cancelled: {
    title: "Cancelled",
    detail: "This order was cancelled before delivery was completed.",
    progress: 0,
    nextTitle: "This order is no longer active",
    nextDetail: "No more action is needed on this order unless our team shared a follow-up update with you.",
    tone: "border-red-200 bg-[linear-gradient(135deg,#fff1f2_0%,#f8fafc_100%)]",
  },
  refunded: {
    title: "Refunded",
    detail: "A refund was recorded for this order.",
    progress: 0,
    nextTitle: "Refund has been recorded",
    nextDetail: "Use the payment reference below if you ever need to cross-check this refund with your support history.",
    tone: "border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_100%)]",
  },
};

const timelineSteps = [
  { key: "placed", label: "Order placed" },
  { key: "paid", label: "Payment confirmed" },
  { key: "delivery", label: "Delivery moving" },
  { key: "done", label: "Delivered" },
];

function formatMoney(value) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function formatDateLabel(value, fallback) {
  return value ? new Date(value).toLocaleString() : fallback;
}

function toLabel(value, fallback = "Not available") {
  if (!value) return fallback;
  return String(value).replaceAll("_", " ");
}

function TimelineStep({ label, active, complete, isLast }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
            complete
              ? "border-[#102A43]/15 bg-slate-100 text-[#102A43]"
              : active
                ? "border-orange-200 bg-orange-50 text-orange-700"
                : "border-slate-200 bg-white text-slate-400"
          }`}
        >
          {complete ? <FiCheckCircle size={15} /> : active ? <FiClock size={15} /> : <span>{label[0]}</span>}
        </div>
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${active || complete ? "text-slate-900" : "text-slate-400"}`}>{label}</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
            {complete ? "Done" : active ? "Now" : "Coming up"}
          </p>
        </div>
      </div>
      {!isLast ? <div className="hidden h-px flex-1 bg-slate-200 xl:block" /> : null}
    </div>
  );
}

export default function OrderCard({
  order,
  busy = false,
  onRefreshPaymentStatus,
  onRetryPaymentPush,
  onReorder,
  onReportDeliveryIssue,
  getReviewInsight,
  onOpenReview,
}) {
  const items = Array.isArray(order.items) ? order.items : [];
  const label = toLabel(order.status, "pending");
  const meta = orderStatusMeta[order.status] || orderStatusMeta.pending;
  const isAwaitingMobilePayment =
    order.paymentMethod === "mobile_money" && !order.isPaid && order.status === "pending";
  const paymentStatus = toLabel(order.payment?.status || order.paymentStatus || "", "Awaiting update");
  const paymentReference = order.payment?.reference || order.paymentReference || null;
  const paymentFailureReason = order.payment?.failureReason || order.paymentFailureReason || null;
  const currentProvider = order.payment?.provider || order.paymentProvider || "";
  const contactPhone = order.delivery?.contactPhone || "";
  const [selectedNetwork, setSelectedNetwork] = useState(
    normalizePaymentNetworkProvider(currentProvider)
  );
  const selectedNetworkPrefixes = getMobileNetworkPrefixes(selectedNetwork);
  const selectedNetworkLabel = getMobileNetworkLabel(selectedNetwork);
  const detectedNetwork = detectMobileNetworkFromPhone(contactPhone);
  const detectedNetworkLabel = detectedNetwork ? getMobileNetworkLabel(detectedNetwork) : null;
  const selectedNetworkValidation = selectedNetwork
    ? validatePhoneForNetwork(contactPhone, selectedNetwork)
    : null;
  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    [items]
  );
  const canReorder = items.length > 0 && ["delivered", "cancelled", "refunded"].includes(order.status);
  const hasDeliveryIssue = Boolean(order.delivery?.issueReportedAt || order.delivery?.issueReason);
  const reviewableItems = useMemo(() => {
    if (order.status !== "delivered") {
      return [];
    }

    const seen = new Set();

    return items
      .filter((item) => item.product)
      .filter((item) => {
        const key = String(item.product);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .map((item) => ({
        ...item,
        reviewInsight: typeof getReviewInsight === "function" ? getReviewInsight(item.product) : null,
      }));
  }, [getReviewInsight, items, order.status]);

  useEffect(() => {
    setSelectedNetwork(normalizePaymentNetworkProvider(currentProvider));
  }, [currentProvider]);

  const timelineState = useMemo(() => {
    return timelineSteps.map((step, index) => ({
      ...step,
      complete: meta.progress > index || (order.status === "delivered" && index === timelineSteps.length - 1),
      active: meta.progress === index && order.status !== "delivered",
    }));
  }, [meta.progress, order.status]);

  return (
    <article className="rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-5 shadow-[0_20px_40px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_50px_rgba(15,23,42,0.10)] md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#102A43]">Marketplace order</p>
          <h3 className="font-black text-slate-900">#{String(order._id).slice(-6)}</h3>
          <p className="mt-2 text-lg font-black text-slate-900">{meta.title}</p>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{meta.detail}</p>
        </div>

        <div className="flex flex-col items-start gap-2 md:items-end">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass[order.status] || "bg-slate-50 text-slate-700 border-slate-200"}`}>
            {label}
          </span>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Placed {formatDateLabel(order.createdAt, "Recently placed")}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Order journey</p>
                <p className="mt-1 text-sm text-slate-500">Follow the steps from payment through delivery.</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {totalItems} item{totalItems === 1 ? "" : "s"}
              </div>
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-4">
              {timelineState.map((step, index) => (
                <TimelineStep
                  key={step.key}
                  label={step.label}
                  active={step.active}
                  complete={step.complete}
                  isLast={index === timelineState.length - 1}
                />
              ))}
            </div>
          </div>

          <div className={`rounded-[24px] border p-4 text-sm text-slate-700 ${meta.tone}`}>
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white/80 p-3 text-slate-700 shadow-sm">
                {order.status === "out_for_delivery" ? <FiTruck size={18} /> : order.status === "delivered" ? <FiCheckCircle size={18} /> : order.status === "paid" ? <FiPackage size={18} /> : <FiShield size={18} />}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">What happens next</p>
                <p className="mt-1 text-base font-bold text-slate-900">{meta.nextTitle}</p>
                <p className="mt-2 text-sm text-slate-600">{meta.nextDetail}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Order basket</p>
                <p className="mt-1 text-base font-bold text-slate-900">{formatMoney(order.totalAmount || 0)}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                  Payment: {toLabel(order.paymentMethod || "mobile_money", "mobile money")}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-[#102A43]">
                  {totalItems} item{totalItems === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
              {items.map((item, i) => (
                <div key={`${item.product}-${i}`} className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate">{item.name || "Item"} x {item.qty}</p>
                  <span className="shrink-0 font-semibold text-slate-900">{formatMoney(Number(item.price || 0) * Number(item.qty || 0))}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#fff7ed_100%)] p-4 text-sm text-slate-700">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Delivery snapshot</p>
            <p className="mt-3 inline-flex items-center gap-2 font-semibold text-slate-900"><FiMapPin /> {order.delivery?.address || "Pickup at store"}</p>
            <p className="mt-2 inline-flex items-center gap-2 text-slate-600"><FiPhone /> {contactPhone || "No contact phone"}</p>
            <div className="mt-3 rounded-2xl bg-white/80 px-3 py-3 text-sm text-slate-600">
              {order.status === "out_for_delivery" ? (
                <p>Your delivery is in motion. Keep your phone close in case the rider needs to reach you.</p>
              ) : order.status === "delivered" ? (
                <p>This address has already received the order successfully.</p>
              ) : (
                <p>We will use these delivery details for the next update on this order.</p>
              )}
            </div>

            {order.status === "delivered" && (order.delivery?.proofRecipient || order.delivery?.proofNote) ? (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Delivery proof</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Received by</p>
                    <p className="mt-1 font-semibold text-slate-900">{order.delivery?.proofRecipient || "Not recorded"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Rider note</p>
                    <p className="mt-1 text-sm text-slate-600">{order.delivery?.proofNote || "No note was added for this delivery."}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {order.status === "delivered" ? (
              <div className={`mt-3 rounded-2xl border px-3 py-3 ${hasDeliveryIssue ? "border-red-200 bg-red-50/70" : "border-slate-200 bg-white/80"}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${hasDeliveryIssue ? "text-red-600" : "text-slate-400"}`}>
                      Delivery support
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {hasDeliveryIssue
                        ? "Your delivery issue has been recorded for follow-up."
                        : "If anything about the handoff was wrong, report it here for operations review."}
                    </p>
                  </div>
                  {!hasDeliveryIssue && onReportDeliveryIssue ? (
                    <button
                      type="button"
                      onClick={() => onReportDeliveryIssue(order)}
                      disabled={busy}
                      className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      Report delivery issue
                    </button>
                  ) : null}
                </div>

                {hasDeliveryIssue ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Reported</p>
                      <p className="mt-1 font-semibold text-slate-900">{formatDateLabel(order.delivery?.issueReportedAt, "Recently")}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Issue status</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {toLabel(order.delivery?.issueStatus || "open", "open")}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Issue note</p>
                      <p className="mt-1 text-sm text-slate-600">{order.delivery?.issueReason || "No issue note recorded."}</p>
                    </div>
                    {order.delivery?.issueResolutionNote ? (
                      <div className="sm:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Resolution update</p>
                        <p className="mt-1 text-sm text-slate-600">{order.delivery.issueResolutionNote}</p>
                        {order.delivery?.issueResolvedAt ? (
                          <p className="mt-2 text-xs font-medium text-emerald-700">
                            Resolved {formatDateLabel(order.delivery.issueResolvedAt, "recently")}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#fffaf5_0%,#f8fafc_100%)] p-4 text-sm text-slate-700">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Payment snapshot</p>
                <p className="mt-1 text-sm text-slate-500">Everything tied to your payment sits here for quick reference.</p>
              </div>
              <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                Updated {formatDateLabel(order.updatedAt || order.createdAt, "just now")}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Payment method</p>
                <p className="mt-2 font-semibold text-slate-900">{toLabel(order.paymentMethod || "mobile_money", "mobile money")}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Payment status</p>
                <p className="mt-2 font-semibold text-slate-900">{paymentStatus}</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Payment provider</p>
              {currentProvider ? (
                <div className="mt-2">
                  <PaymentNetworkBadge provider={currentProvider} />
                </div>
              ) : selectedNetwork ? (
                <div className="mt-2">
                  <PaymentNetworkBadge provider={selectedNetwork} />
                </div>
              ) : (
                <p className="mt-2 font-semibold text-slate-900">Mobile Money</p>
              )}
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Reference</p>
              <p className="mt-2 break-all font-semibold text-slate-900">{paymentReference || "This will appear as soon as the payment provider returns a reference."}</p>
            </div>

            {paymentFailureReason ? (
              <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-red-700">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-500">Payment issue</p>
                <p className="mt-2 text-sm">{paymentFailureReason}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {canReorder && onReorder ? (
        <div className="mt-5 rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_100%)] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#102A43]">Buy again</p>
              <p className="mt-1 text-sm text-slate-600">Add the available items from this order back into your cart and keep shopping from where you left off.</p>
            </div>
                                <button
              type="button"
              onClick={() => onReorder(order)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#102A43_0%,#081B2E_100%)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              <FiShoppingBag /> Buy again
            </button>
          </div>
        </div>
      ) : null}

      {reviewableItems.length ? (
        <div className="mt-5 rounded-[24px] border border-orange-200 bg-[linear-gradient(135deg,#fffaf0_0%,#f8fafc_100%)] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">Shopper reviews</p>
              <p className="mt-1 text-sm text-slate-600">
                Help the next buyer by sharing how these delivered items felt after payment and delivery.
              </p>
            </div>
            <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
              {reviewableItems.length} review option{reviewableItems.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {reviewableItems.map((item) => {
              const insight = item.reviewInsight || {};
              const hasReview = Boolean(insight.userReview);
              const canReview = Boolean(insight.canReview);

              return (
                <div
                  key={String(item.product)}
                  className="rounded-2xl border border-slate-200 bg-white/80 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{item.name || "Delivered item"}</p>
                      <div className="mt-2">
                        <MarketplaceRating
                          averageRating={insight.summary?.averageRating}
                          reviewCount={insight.summary?.reviewCount}
                          compact
                        />
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {hasReview
                          ? `You already rated this item ${Number(insight.userReview?.rating || 0)}/5. You can update it any time.`
                          : canReview
                            ? "Your delivered order qualifies for a verified shopper review."
                            : "Review access will appear here after delivery eligibility is confirmed."}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenReview?.(item, insight)}
                      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                        hasReview
                          ? "border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                          : "bg-[linear-gradient(135deg,#102A43_0%,#081B2E_100%)] text-white hover:-translate-y-0.5"
                      }`}
                    >
                      {hasReview ? <FiEdit3 /> : <FiStar />}
                      {hasReview ? "Update review" : "Share review"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {isAwaitingMobilePayment && onRefreshPaymentStatus && onRetryPaymentPush ? (
        <div className="mt-5 space-y-3 rounded-[24px] border border-orange-200 bg-orange-50/70 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
              Payment follow-up
            </p>
            <p className="mt-1 text-sm text-orange-800">
              Check the latest result or send a fresh prompt if the first request expired before you approved it.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Network
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {MOBILE_PAYMENT_NETWORK_OPTIONS.map((network) => {
                const active = selectedNetwork === network.value;

                return (
                  <button
                    key={network.value}
                    type="button"
                    onClick={() => setSelectedNetwork(network.value)}
                    disabled={busy}
                    className={`rounded-2xl border px-3 py-2 text-left text-sm shadow-sm transition disabled:opacity-60 ${
                      active
                        ? "border-orange-300 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_100%)]"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <PaymentNetworkBadge provider={network.value} className="font-medium text-slate-900" />
                  </button>
                );
              })}
            </div>
            {selectedNetwork ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-sm text-slate-600">
                <p>
                  Selected network: <span className="font-semibold text-slate-900">{selectedNetworkLabel}</span>
                </p>
                <p className="mt-1">
                  Order phone: <span className="font-semibold text-slate-900">{contactPhone || "N/A"}</span>
                </p>
                {detectedNetworkLabel ? (
                  <p className="mt-1">
                    Detected from number: <span className="font-semibold text-slate-900">{detectedNetworkLabel}</span>
                  </p>
                ) : null}
                <p className="mt-1">
                  Valid prefixes: <span className="font-semibold text-slate-900">{selectedNetworkPrefixes.join(", ") || "N/A"}</span>
                </p>
                {selectedNetworkValidation && !selectedNetworkValidation.valid ? (
                  <p className="mt-2 text-red-600">{selectedNetworkValidation.message}</p>
                ) : (
                  <p className="mt-2 text-[#102A43]">This number matches {selectedNetworkLabel}.</p>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onRefreshPaymentStatus(order._id)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <FiRefreshCw /> Check payment
            </button>
            <button
              type="button"
              onClick={() => onRetryPaymentPush(order._id, selectedNetwork)}
              disabled={busy || !selectedNetwork}
              className="rounded-xl border border-orange-300 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_100%)] px-3 py-2 text-sm font-medium text-orange-700 shadow-sm transition hover:border-orange-400 disabled:opacity-50"
            >
              New payment prompt
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
