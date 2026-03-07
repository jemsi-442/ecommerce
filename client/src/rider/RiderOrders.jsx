import { useEffect, useState } from "react";
import axios from "../utils/axios";
import { extractList } from "../utils/apiShape";
import useToast from "../hooks/useToast";

const AUTO_REFRESH_INTERVAL = 15000;
const SLA_SECONDS = 120;

const RiderOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [now, setNow] = useState(Date.now());
  const toast = useToast();

  const fetchOrders = async () => {
    try {
      const { data } = await axios.get("/rider/orders");
      setOrders(extractList(data, ["orders", "items"]));
    } catch (err) {
      console.error(err);
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

  const getRemainingSeconds = (assignedAt) => {
    const elapsed = Math.floor((now - new Date(assignedAt).getTime()) / 1000);
    return Math.max(SLA_SECONDS - elapsed, 0);
  };

  const handleAction = async (orderId, action) => {
    if (!window.confirm(`Confirm ${action}?`)) return;

    setActionLoading(orderId);
    try {
      await axios.put(`/rider/orders/${orderId}/${action}`);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <p className="p-4 text-slate-500">Loading deliveries...</p>;

  if (orders.length === 0) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">No active deliveries.</div>;
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h2 className="text-2xl font-black text-slate-900">Assigned Deliveries</h2>

      {orders.map((order) => {
        const accepted = Boolean(order.delivery?.acceptedAt);
        const assignedAt = order.delivery?.assignedAt;
        const remaining = assignedAt ? getRemainingSeconds(assignedAt) : null;
        const percent = remaining !== null ? Math.round((remaining / SLA_SECONDS) * 100) : 100;
        const danger = remaining !== null && remaining <= 20;

        return (
          <div key={order._id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="font-black text-slate-900">Order #{String(order._id).slice(-6)}</span>
              {!accepted && remaining !== null && <RadialTimer percent={percent} danger={danger} remaining={remaining} />}
            </div>

            <div className="text-sm space-y-1 text-slate-600">
              <p><strong>Customer:</strong> {order.user?.name || "Unknown"}</p>
              <p><strong>Phone:</strong> {order.user?.phone || "-"}</p>
              <p><strong>Address:</strong> {order.delivery?.address || "Pickup"}</p>
            </div>

            {!accepted ? (
              <div className="grid sm:grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => handleAction(order._id, "accept")}
                  disabled={remaining === 0 || actionLoading === order._id}
                  className={`py-2.5 rounded-xl text-white font-medium ${remaining === 0 ? "bg-slate-400" : "bg-emerald-600 hover:bg-emerald-700"}`}
                >
                  Accept
                </button>

                <button
                  onClick={() => handleAction(order._id, "reject")}
                  disabled={actionLoading === order._id}
                  className="py-2.5 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700"
                >
                  Reject
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleAction(order._id, "delivered")}
                disabled={actionLoading === order._id}
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700"
              >
                Mark Delivered
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default RiderOrders;

const RadialTimer = ({ percent, remaining, danger }) => {
  const stroke = 4;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width="50" height="50">
      <circle cx="25" cy="25" r={radius} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
      <circle
        cx="25"
        cy="25"
        r={radius}
        stroke={danger ? "#dc2626" : "#f59e0b"}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 25 25)"
      />
      <text x="25" y="30" textAnchor="middle" fontSize="12" fontWeight="bold" fill={danger ? "#dc2626" : "#f59e0b"}>
        {remaining}s
      </text>
    </svg>
  );
};
