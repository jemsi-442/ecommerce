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

  const markPaidAndDispatch = async (orderId) => {
    try {
      setUpdatingId(orderId);
      await axios.put(`/orders/${orderId}/pay`);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to dispatch order");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <TableSkeleton rows={6} />;

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-xl md:text-2xl font-bold text-gray-800">
        Orders Management
      </h1>
      {error ? <PageState tone="error" title="Orders unavailable" description={error} /> : null}

      <div className="overflow-x-auto bg-white shadow rounded-xl">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3">Total</th>
              <th className="p-3">Status</th>
              <th className="p-3">Delivery</th>
              <th className="p-3">Rider</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {orders.map((order) => (
              <tr
                key={order._id}
                className="border-b hover:bg-gray-50"
              >
                {/* CUSTOMER */}
                <td className="p-3">
                  <div className="font-medium">
                    {order.user?.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {order.user?.email}
                  </div>
                </td>

                {/* TOTAL */}
                <td className="p-3 text-center font-semibold">
                  TZS {order.totalAmount.toLocaleString()}
                </td>

                {/* STATUS */}
                <td className="p-3 text-center">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}
                  >
                    {order.status.replaceAll("_", " ")}
                  </span>
                </td>

                {/* DELIVERY */}
                <td className="p-3 text-center">
                  <FaTruck className="inline mr-1 text-gray-500" />
                  {order.delivery?.type}
                </td>

                {/* RIDER */}
                <td className="p-3 text-center text-xs">
                  {order.delivery?.rider ? (
                    <>
                      <div className="font-medium">
                        {order.delivery.rider.name}
                      </div>
                      <div className="text-gray-500">
                        {order.delivery.rider.phone}
                      </div>
                    </>
                  ) : (
                    <span className="text-gray-400">—</span>
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
                      className="px-3 py-1.5 text-xs rounded-lg border hover:bg-gray-100"
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

                  {order.status === "pending" && (
                    <button
                      disabled={updatingId === order._id}
                      onClick={() => markPaidAndDispatch(order._id)}
                      className="px-3 py-1.5 text-xs rounded-lg border hover:bg-gray-100"
                    >
                      <FaMoneyBillWave className="inline mr-1" />
                      pay & dispatch
                    </button>
                  )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
