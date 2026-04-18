import { useEffect, useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import InternalFooter from "../../components/InternalFooter";
import { useAuth } from "../../hooks/useAuth";
import useNotificationAlerts from "../../hooks/useNotificationAlerts";
import useNotificationPreferences from "../../hooks/useNotificationPreferences";
import useNotificationSummary from "../../hooks/useNotificationSummary";

export default function AdminLayout() {
  const { user } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const notificationPreferences = useNotificationPreferences("admin");
  const notificationSummary = useNotificationSummary({
    enabled: user?.role === "admin",
    mode: "admin",
  });
  const { unreadCount } = notificationSummary;

  useNotificationAlerts({
    enabled: user?.role === "admin",
    mode: "admin",
    soundEnabled: notificationPreferences.soundEnabled,
    vibrationEnabled: notificationPreferences.vibrationEnabled,
  });

  useEffect(() => {
    if (!mobileSidebarOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileSidebarOpen]);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eff6ff_36%,#fff7ed_100%)]">
      <AdminSidebar className="hidden lg:flex" unreadCount={unreadCount} />

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
            aria-label="Close sidebar overlay"
          />
          <AdminSidebar
            mobile
            unreadCount={unreadCount}
            onNavigate={() => setMobileSidebarOpen(false)}
            onClose={() => setMobileSidebarOpen(false)}
            className="relative z-10 min-h-full shadow-2xl"
          />
        </div>
      ) : null}

      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        <AdminTopbar
          unreadCount={unreadCount}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
        />
        <main className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(160deg,#f8fafc_0%,#eff6ff_48%,#fff7ed_100%)] p-4 pb-6 md:p-6">
          <Outlet />
        </main>
        <InternalFooter />
      </div>
    </div>
  );
}
