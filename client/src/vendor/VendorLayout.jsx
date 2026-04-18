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
    <div className="flex h-screen min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eff6ff_38%,#fff7ed_100%)]">
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <VendorTopbar onOpenSidebar={() => setMobileSidebarOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(160deg,#f8fafc_0%,#eff6ff_52%,#fff7ed_100%)] p-4 pb-6 md:p-6">
          <Outlet />
        </main>
        <InternalFooter />
      </div>
    </div>
  );
}
