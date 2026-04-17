import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../utils/axios";
import { extractList } from "../utils/apiShape";

const emptySummary = {
  notifications: [],
  unreadCount: 0,
};

export default function useNotificationSummary({ enabled = true, mode = "customer" } = {}) {
  const location = useLocation();
  const [summary, setSummary] = useState(emptySummary);

  useEffect(() => {
    if (!enabled) {
      setSummary(emptySummary);
      return undefined;
    }

    let active = true;

    const fetchSummary = async () => {
      try {
        const endpoint = mode === "admin" ? "/notifications" : "/notifications/my";
        const { data } = await api.get(endpoint);
        const notifications = extractList(data, ["items", "notifications"]);

        if (!active) {
          return;
        }

        setSummary({
          notifications,
          unreadCount: notifications.filter((notification) => !notification.read).length,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setSummary(emptySummary);
      }
    };

    fetchSummary();
    const handleRefresh = (event) => {
      if (event?.detail?.mode && event.detail.mode !== mode) {
        return;
      }

      fetchSummary();
    };

    window.addEventListener("notifications:refresh", handleRefresh);
    const intervalId = window.setInterval(fetchSummary, 30000);

    return () => {
      active = false;
      window.removeEventListener("notifications:refresh", handleRefresh);
      window.clearInterval(intervalId);
    };
  }, [enabled, location.key, mode]);

  return summary;
}
