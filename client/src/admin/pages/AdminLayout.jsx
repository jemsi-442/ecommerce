import { Outlet, Navigate, NavLink } from "react-router-dom";
import { FiHome, FiPackage, FiShoppingBag, FiUsers, FiBell } from "react-icons/fi";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import { useAuth } from "../../hooks/useAuth";

const mobileNav = [
  { to: "/admin", label: "Dash", icon: FiHome },
  { to: "/admin/products", label: "Products", icon: FiPackage },
  { to: "/admin/orders", label: "Orders", icon: FiShoppingBag },
  { to: "/admin/users", label: "Users", icon: FiUsers },
  { to: "/admin/notifications", label: "Alerts", icon: FiBell },
];

export default function AdminLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-slate-100 overflow-hidden">
      <AdminSidebar className="hidden lg:flex" />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 lg:pb-6 bg-[linear-gradient(160deg,#f8fafc_0%,#f1f5f9_100%)]">
          <Outlet />
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 z-40">
        <div className="grid grid-cols-4">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/admin"}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-2 text-xs ${isActive ? "text-rose-600" : "text-slate-500"}`
                }
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
