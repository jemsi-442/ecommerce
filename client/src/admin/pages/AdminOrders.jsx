import { useEffect, useMemo, useState } from "react";
import axios from "../../utils/axios";
import {
  FaTruck,
  FaCheckCircle,
  FaMoneyBillWave,
} from "react-icons/fa";
import { extractList } from "../../utils/apiShape";
import PageState from "../../components/PageState";
import { useToast } from "../../hooks/useToast";
import { TableSkeleton } from "../../components/Skeleton";
import PaymentNetworkBadge from "../../components/PaymentNetworkBadge";
import { getOrderStatusTone } from "../../utils/statusStyles";

const NEXT_STATUS = {
  paid: ["out_for_delivery", "refunded"],
  out_for_delivery: ["delivered", "refunded"],
};

export default function AdminOrders() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [issueFilter, setIssueFilter] = useState("all");
  const [issueDrafts, setIssueDrafts] = useState({});

  // ================= FETCH ORDERS =================
  const fetchOrders = async () => {
    try {
      const { data } = await axios.get("/orders");
      setOrders(extractList(data, ["orders", "items"]));
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // ================= UPDATE STATUS =================
  const updateStatus = async (orderId, status) => {
    try {
      setUpdatingId(orderId);
      await axios.put(`/orders/${orderId}/status`, { status });
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Status update failed");
    } finally {
      setUpdatingId(null);
    }
  };

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

  const updateDeliveryIssue = async (orderId) => {
    const draft = issueDrafts[String(orderId)] || { status: "open", resolutionNote: "" };
    try {
      setUpdatingId(orderId);
      await axios.patch(`/orders/${orderId}/delivery-issue`, draft);
      toast.success("Delivery issue updated");
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update delivery issue");
    } finally {
      setUpdatingId(null);
    }
  };

  const summary = useMemo(() => {
    const paid = orders.filter((order) => order.payment?.isPaid || order.isPaid).length;
    const delivery = orders.filter((order) => order.status === "out_for_delivery").length;
    const pendingPayment = orders.filter(
      (order) => !(order.payment?.isPaid || order.isPaid) && order.status === "pending"
    ).length;
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const issueOrders = orders.filter((order) => Boolean(order.delivery?.issueReason));
    const openIssues = issueOrders.filter(
      (order) => !order.delivery?.issueStatus || order.delivery?.issueStatus === "open"
    ).length;
    const investigatingIssues = issueOrders.filter(
      (order) => order.delivery?.issueStatus === "investigating"
    ).length;
    const resolvedIssues = issueOrders.filter(
      (order) => order.delivery?.issueStatus === "resolved"
    ).length;

    return {
      total: orders.length,
      paid,
      delivery,
      pendingPayment,
      totalRevenue,
      issueOrders: issueOrders.length,
      openIssues,
      investigatingIssues,
      resolvedIssues,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      if (normalizedQuery) {
        const searchableText = [
          order.user?.name,
          order.user?.email,
          order.payment?.reference,
          order.delivery?.address,
          order.delivery?.contactPhone,
          order.delivery?.proofRecipient,
          order.delivery?.proofNote,
          order.delivery?.issueReason,
          order.delivery?.issueStatus,
          order.delivery?.issueResolutionNote,
          order.delivery?.rider?.name,
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

      const paymentState = order.payment?.status || (order.isPaid ? "completed" : "pending");
      if (paymentFilter !== "all" && paymentState !== paymentFilter) {
        return false;
      }

      if (deliveryFilter !== "all" && order.delivery?.type !== deliveryFilter) {
        return false;
      }

      if (issueFilter === "reported" && !order.delivery?.issueReason) {
        return false;
      }

      if (issueFilter === "open") {
        if (!order.delivery?.issueReason) {
          return false;
        }

        if (order.delivery?.issueStatus && order.delivery.issueStatus !== "open") {
          return false;
        }
      }

      if (issueFilter === "investigating" && order.delivery?.issueStatus !== "investigating") {
        return false;
      }

      if (issueFilter === "resolved" && order.delivery?.issueStatus !== "resolved") {
        return false;
      }

      return true;
    });
  }, [deliveryFilter, issueFilter, orders, paymentFilter, searchQuery, statusFilter]);

  if (loading) return <TableSkeleton rows={6} />;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_42%,#fff7ed_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Order Center</p>
        <h1 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">
          Order Management
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Track sales, payments, and delivery progress in one organized table.
        </p>
      </div>
      {error ? <PageState tone="error" title="Orders unavailable" description={error} /> : null}

      <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <div className="surface-panel-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Orders</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{summary.total}</p>
        </div>
        <div className="surface-panel-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Paid</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">{summary.paid}</p>
        </div>
        <div className="surface-panel-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Out for delivery</p>
          <p className="mt-2 text-2xl font-black text-orange-600">{summary.delivery}</p>
        </div>
        <div className="surface-panel-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Revenue</p>
          <p className="mt-2 text-2xl font-black text-[#102A43]">TZS {summary.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="surface-panel-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Issues</p>
          <p className="mt-2 text-2xl font-black text-red-600">{summary.issueOrders}</p>
        </div>
        <div className="surface-panel-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Open</p>
          <p className="mt-2 text-2xl font-black text-red-600">{summary.openIssues}</p>
        </div>
        <div className="surface-panel-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Investigating</p>
          <p className="mt-2 text-2xl font-black text-orange-600">{summary.investigatingIssues}</p>
        </div>
        <div className="surface-panel-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Resolved</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">{summary.resolvedIssues}</p>
        </div>
      </section>

      <div className="surface-panel-wrap">
        <div className="grid gap-3 border-b border-slate-200/70 bg-white/80 p-4 md:grid-cols-4">
          <label className="block md:col-span-4">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Search orders</span>
            <input
              className="input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by customer, reference, phone, address, or rider"
            />
            <p className="mt-2 text-xs text-slate-500">
              Showing {filteredOrders.length} of {orders.length} orders
            </p>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status</span>
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
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Payment</span>
            <select className="input" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
              <option value="all">All payments</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Delivery</span>
            <select className="input" value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)}>
              <option value="all">All delivery types</option>
              <option value="home">Home</option>
              <option value="pickup">Pickup</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Issue queue</span>
            <select className="input" value={issueFilter} onChange={(event) => setIssueFilter(event.target.value)}>
              <option value="all">All orders</option>
              <option value="reported">Reported issues</option>
              <option value="open">Open issues</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved issues</option>
            </select>
          </label>

          <div className="rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-3 text-sm text-orange-800">
            <p className="font-semibold">Pending payment</p>
            <p className="mt-1 text-lg font-black">{summary.pendingPayment}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_100%)] text-slate-600">
            <tr>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3">Total</th>
              <th className="p-3">Status</th>
              <th className="p-3">Payment</th>
              <th className="p-3">Delivery</th>
              <th className="p-3">Rider</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredOrders.map((order) => (
              <tr
                key={order._id}
                className="border-b border-slate-100 transition hover:bg-orange-50/40"
              >
                {/* CUSTOMER */}
                <td className="p-3">
                  <div className="font-semibold text-slate-800">
                    {order.user?.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {order.user?.email}
                  </div>
                  {order.delivery?.proofRecipient ? (
                    <div className="mt-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      Received by {order.delivery.proofRecipient}
                    </div>
                  ) : null}
                  {order.delivery?.issueReason ? (
                    <div className="mt-2 inline-flex rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                      Delivery issue reported
                    </div>
                  ) : null}
                </td>

                {/* TOTAL */}
                <td className="p-3 text-center font-semibold text-slate-800">
                  TZS {order.totalAmount.toLocaleString()}
                </td>

                {/* STATUS */}
                <td className="p-3 text-center">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusTone(order.status)}`}
                  >
                    {order.status.replaceAll("_", " ")}
                  </span>
                </td>

                <td className="p-3 text-center text-xs">
                  <div className="font-medium">
                    {String(order.paymentMethod || "mobile_money").replaceAll("_", " ")}
                  </div>
                  {order.payment?.provider ? (
                    <div className="mt-1 text-slate-500">
                      <PaymentNetworkBadge provider={order.payment.provider} className="justify-center" />
                    </div>
                  ) : null}
                  <div className="text-slate-500">
                    {String(order.payment?.status || (order.isPaid ? "completed" : "pending")).replaceAll("_", " ")}
                  </div>
                  {order.payment?.reference ? (
                    <div className="text-slate-400">{order.payment.reference}</div>
                  ) : null}
                </td>

                {/* DELIVERY */}
                <td className="p-3 text-center">
                  <FaTruck className="mr-1 inline text-slate-400" />
                  {order.delivery?.type}
                  {order.delivery?.issueReportedAt ? (
                    <div className="mt-2 text-[11px] text-red-600">
                      Issue logged {new Date(order.delivery.issueReportedAt).toLocaleDateString()}
                    </div>
                  ) : null}
                </td>

                {/* RIDER */}
                <td className="p-3 text-center text-xs">
                  {order.delivery?.rider ? (
                    <>
                      <div className="font-semibold text-slate-800">
                        {order.delivery.rider.name}
                      </div>
                      <div className="text-slate-500">
                        {order.delivery.rider.phone}
                      </div>
                      {order.delivery?.proofNote ? (
                        <div className="mt-2 max-w-[220px] text-left text-[11px] text-slate-500">
                          Note: {order.delivery.proofNote}
                        </div>
                      ) : null}
                      {order.delivery?.issueReason ? (
                        <div className="mt-2 max-w-[220px] text-left text-[11px] text-red-600">
                          Issue: {order.delivery.issueReason}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>

                {/* ACTIONS */}
                <td className="p-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                  {NEXT_STATUS[order.status]?.map((next) => (
                    <button
                      key={next}
                      disabled={updatingId === order._id}
                      onClick={() =>
                        updateStatus(order._id, next)
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-amber-200 hover:bg-amber-50"
                    >
                      {next === "delivered" && (
                        <FaCheckCircle className="inline mr-1" />
                      )}
                      {next === "refunded" && (
                        <FaMoneyBillWave className="inline mr-1" />
                      )}
                      {next.replaceAll("_", " ")}
                    </button>
                  ))}
                  {order.delivery?.issueReason ? (
                    <button
                      type="button"
                      disabled={updatingId === order._id}
                      onClick={() => updateDeliveryIssue(order._id)}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm transition hover:bg-red-100"
                    >
                      Save issue
                    </button>
                  ) : null}
                  </div>
                  {order.delivery?.issueReason ? (
                    <div className="mt-3 space-y-2 rounded-2xl border border-red-100 bg-red-50/60 p-3 text-left">
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
                      <div className="text-[11px] text-slate-500">
                        Current status: {String(order.delivery?.issueStatus || "open").replaceAll("_", " ")}
                        {order.delivery?.issueResolvedAt ? ` • Resolved ${new Date(order.delivery.issueResolvedAt).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filteredOrders.length === 0 ? (
          <div className="border-t border-slate-200/70 px-4 py-8 text-center text-sm text-slate-500">
            No orders match the current filters.
          </div>
        ) : null}
      </div>
    </div>
  );
}
