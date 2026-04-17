import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import InternalFooter from "../components/InternalFooter";
import { useAuth } from "../hooks/useAuth";
import VendorSidebar from "./VendorSidebar";
import VendorTopbar from "./VendorTopbar";

export default function VendorLayout() {
  const { user } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
    <div className="flex min-h-screen bg-slate-100 overflow-hidden">
      <VendorSidebar className="hidden lg:flex" />

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
            aria-label="Close sidebar overlay"
          />
          <VendorSidebar
            mobile
            onNavigate={() => setMobileSidebarOpen(false)}
            onClose={() => setMobileSidebarOpen(false)}
            className="relative z-10 min-h-full shadow-2xl"
          />
        </div>
      ) : null}

      <div className="flex-1 flex min-w-0 flex-col">
        <VendorTopbar onOpenSidebar={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-[linear-gradient(160deg,#fffbeb_0%,#f8fafc_52%,#eef2ff_100%)] p-4 md:p-6 pb-6">
          <Outlet />
        </main>
        <InternalFooter />
      </div>
    </div>
  );
}
