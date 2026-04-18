import { useEffect, useState } from "react";
import axios from "../../utils/axios";
import { FaPaperPlane } from "react-icons/fa";
import { extractList } from "../../utils/apiShape";
import PageState from "../../components/PageState";
import useNotificationPreferences from "../../hooks/useNotificationPreferences";
import useToast from "../../hooks/useToast";

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [paymentLogs, setPaymentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);
  const [markingId, setMarkingId] = useState(null);
  const [error, setError] = useState("");
  const toast = useToast();
  const notificationPreferences = useNotificationPreferences("admin");

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get("/admin/audit");
      const logs = extractList(data, ["items"]);
      setNotifications(logs.filter((item) => item.type === "notification"));
      setPaymentLogs(logs.filter((item) => item.type === "payment"));
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to fetch notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const sendNotification = async (orderId) => {
    try {
      setSendingId(orderId);
      await axios.post(`/admin/notifications/send`, { orderId });
      fetchNotifications();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to send notification");
    } finally {
      setSendingId(null);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      setMarkingId(notificationId);
      await axios.patch(`/notifications/${notificationId}/read`);
      fetchNotifications();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to mark notification as read");
    } finally {
      setMarkingId(null);
    }
  };

  if (loading) return <PageState title="Loading notifications..." />;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="rounded-[28px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_44%,#fff7ed_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Operations Signals</p>
        <h1 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">Notifications</h1>
      </div>
      {error ? (
        <PageState tone="error" title="Notifications unavailable" description={error} />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold uppercase tracking-[0.18em] text-slate-400">
          Live Alerts
        </span>
        <button
          type="button"
          onClick={() => notificationPreferences.setSoundEnabled(!notificationPreferences.soundEnabled)}
          className={`rounded-full border px-3 py-1 ${
            notificationPreferences.soundEnabled
              ? "border-orange-300 bg-orange-50 text-orange-700"
              : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          Sound {notificationPreferences.soundEnabled ? "On" : "Off"}
        </button>
        <button
          type="button"
          onClick={() =>
            notificationPreferences.setVibrationEnabled(!notificationPreferences.vibrationEnabled)
          }
          className={`rounded-full border px-3 py-1 ${
            notificationPreferences.vibrationEnabled
              ? "border-orange-300 bg-orange-50 text-orange-700"
              : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          Vibration {notificationPreferences.vibrationEnabled ? "On" : "Off"}
        </button>
      </div>

      <div className="surface-panel-scroll">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-[linear-gradient(135deg,#eff6ff_0%,#fff7ed_100%)] text-slate-600">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Category</th>
              <th className="p-3">Message</th>
              <th className="p-3">Status</th>
              <th className="p-3">Read</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>

          <tbody>
            {notifications.map((n) => (
              <tr key={n._id} className="border-b border-slate-100 hover:bg-orange-50/30">
                <td className="p-3">{String(n.orderId || "").slice(-5)}</td>
                <td className="p-3">{n.customerName || n.userName || "N/A"}</td>
                <td className="p-3 text-xs font-semibold text-slate-700">
                  {n.notificationType || n.type}
                </td>
                <td className="p-3 text-sm text-slate-700">{n.message}</td>
                <td
                  className={`p-3 text-center font-semibold ${
                    n.status === "sent" ? "text-emerald-600" : "text-slate-500"
                  }`}
                >
                  {n.status || "logged"}
                </td>
                <td className="p-3 text-center text-xs text-slate-500">{n.read ? "read" : "unread"}</td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {n.status !== "sent" && n.orderId ? (
                      <button
                        onClick={() => sendNotification(n.orderId)}
                        disabled={sendingId === n.orderId}
                        className="flex items-center space-x-1 rounded-full bg-[linear-gradient(135deg,#102A43_0%,#081B2E_100%)] px-3 py-1 text-xs text-white hover:brightness-110"
                      >
                        <FaPaperPlane />
                        <span>Send</span>
                      </button>
                    ) : (
                      <span>✓</span>
                    )}

                    {!n.read ? (
                      <button
                        onClick={() => markAsRead(n._id)}
                        disabled={markingId === n._id}
                        className="rounded-full border border-orange-300 bg-white px-3 py-1 text-xs font-medium text-orange-700 hover:bg-orange-50"
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {notifications.length === 0 && (
              <tr>
                <td colSpan={7} className="p-3 text-center text-slate-500">
                  No notifications yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="surface-panel-scroll">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-[linear-gradient(135deg,#eff6ff_0%,#fff7ed_100%)] text-slate-600">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Action</th>
              <th className="p-3">Reference</th>
              <th className="p-3">Status</th>
              <th className="p-3">Message</th>
              <th className="p-3">Time</th>
            </tr>
          </thead>

          <tbody>
            {paymentLogs.map((log) => (
              <tr key={log.id} className="border-b border-slate-100 hover:bg-orange-50/30">
                <td className="p-3">{log.orderId ? `#${log.orderId}` : "N/A"}</td>
                <td className="p-3 text-xs font-semibold text-slate-700">{log.action}</td>
                <td className="p-3 text-xs text-slate-500">
                  {log.meta?.reference || log.meta?.receivedReference || "N/A"}
                </td>
                <td className="p-3 text-xs text-slate-500">
                  {log.meta?.paymentStatus || log.meta?.eventType || "logged"}
                </td>
                <td className="p-3 text-sm text-slate-700">{log.message}</td>
                <td className="p-3 text-xs text-slate-500">
                  {log.createdAt ? new Date(log.createdAt).toLocaleString() : "N/A"}
                </td>
              </tr>
            ))}
            {paymentLogs.length === 0 && (
              <tr>
                <td colSpan={6} className="p-3 text-center text-slate-500">
                  No payment webhook logs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
