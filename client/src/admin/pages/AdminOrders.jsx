import { useEffect, useState } from "react";
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

const STATUS_COLORS = {
  pending: "bg-gray-200 text-gray-800",
  paid: "bg-blue-100 text-blue-800",
  out_for_delivery: "bg-orange-100 text-orange-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  refunded: "bg-purple-100 text-purple-800",
};

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

  if (loading) return <TableSkeleton rows={6} />;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-amber-100 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_42%,#eef2ff_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-500">Order Center</p>
        <h1 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">
          Order Management
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Track sales, payments, and delivery progress in one organized table.
        </p>
      </div>
      {error ? <PageState tone="error" title="Orders unavailable" description={error} /> : null}

      <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/92 shadow-[0_20px_40px_rgba(15,23,42,0.07)]">
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
            {orders.map((order) => (
              <tr
                key={order._id}
                className="border-b border-slate-100 transition hover:bg-amber-50/40"
              >
                {/* CUSTOMER */}
                <td className="p-3">
                  <div className="font-semibold text-slate-800">
                    {order.user?.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {order.user?.email}
                  </div>
                </td>

                {/* TOTAL */}
                <td className="p-3 text-center font-semibold text-slate-800">
                  TZS {order.totalAmount.toLocaleString()}
                </td>

                {/* STATUS */}
                <td className="p-3 text-center">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[order.status]}`}
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
