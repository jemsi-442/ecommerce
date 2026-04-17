import { useEffect, useState } from "react";
import axios from "../utils/axios";
import { FaCheckCircle } from "react-icons/fa";
import { extractList } from "../utils/apiShape";
import PageState from "../components/PageState";
import useToast from "../hooks/useToast";

export default function RiderDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const toast = useToast();

  const fetchRiderOrders = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get("/rider/orders");
      const ordersList = extractList(data, ["orders", "items"]);
      setOrders(ordersList.filter((o) => o.status === "out_for_delivery"));
      setError("");
    } catch (err) {
      setError("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiderOrders();
  }, []);

  const markDelivered = async (orderId) => {
    try {
      setUpdatingId(orderId);
      await axios.put(`/rider/orders/${orderId}/delivered`);
      fetchRiderOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to mark delivered");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <PageState title="Loading orders..." />;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="overflow-hidden rounded-[28px] border border-amber-100 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_45%,#fff1f2_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-rose-400">Rider Workspace</p>
        <h1 className="mt-1 text-2xl font-black text-slate-900">My Deliveries</h1>
        <p className="mt-1 text-slate-500">Orders assigned to you right now.</p>
      </div>

      {error ? <PageState tone="error" title="Deliveries unavailable" description={error} /> : null}

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">No current deliveries.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="font-black text-slate-900">Order #{String(order._id).slice(-5)}</span>
                <span className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</span>
              </div>

              <div className="mt-3 text-sm text-slate-600 space-y-1">
                <p>Customer: {order.user?.name || "Unknown"}</p>
                <p>Address: {order.delivery?.address || "Pickup"}</p>
              </div>

              <div className="mt-4 flex justify-between items-center pt-3 border-t border-slate-200">
                <span className="font-semibold text-slate-800">Total: TZS {Number(order.totalAmount).toLocaleString()}</span>
                <button
                  onClick={() => markDelivered(order._id)}
                  disabled={updatingId === order._id}
                  className="inline-flex items-center gap-2 btn-primary text-sm disabled:opacity-60"
                >
                  <FaCheckCircle /> Delivered
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
