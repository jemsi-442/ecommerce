import { NavLink, useNavigate } from "react-router-dom";
import { FiBell, FiCreditCard, FiHome, FiLogOut, FiPackage, FiShoppingBag, FiUsers, FiX } from "react-icons/fi";
import { useAuth } from "../../hooks/useAuth";

const navItems = [
  { name: "Marketplace Home", path: "/admin", icon: FiHome },
  { name: "Catalog", path: "/admin/products", icon: FiPackage },
  { name: "Sales", path: "/admin/orders", icon: FiShoppingBag },
  { name: "Customers", path: "/admin/users", icon: FiUsers },
  { name: "Updates", path: "/admin/notifications", icon: FiBell },
  { name: "Vendor Settlements", path: "/admin/payouts", icon: FiCreditCard },
];

export default function AdminSidebar({
  className = "",
  unreadCount = 0,
  mobile = false,
  onNavigate,
  onClose,
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/login");
    onNavigate?.();
  };

  return (
    <aside className={`sticky top-0 flex h-screen w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-900/10 bg-[linear-gradient(180deg,#0f172a_0%,#172554_48%,#1e293b_100%)] text-slate-200 ${className}`}>
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-orange-200/90">Seller & shopper hub</p>
            <h1 className="mt-2 text-xl font-black text-white">
              Ecommerce <span className="text-orange-300">Marketplace</span>
            </h1>
            <p className="mt-1 text-xs tracking-wide text-slate-400">Commerce Hub</p>
          </div>
          {mobile ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5 lg:hidden"
              aria-label="Close sidebar"
            >
              <FiX size={18} />
            </button>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === "/admin"}
              onClick={() => onNavigate?.()}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "border border-orange-300/25 bg-orange-400/15 text-orange-100 shadow-[0_14px_30px_rgba(242,140,40,0.12)]"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon size={18} />
              <span className="flex items-center gap-2">
                {item.name}
                {item.path === "/admin/notifications" && unreadCount > 0 ? (
                  <span className="rounded-full bg-[linear-gradient(135deg,#f59e0b_0%,#f97316_100%)] px-2 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-amber-500/20">
                    {unreadCount}
                  </span>
                ) : null}
              </span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
        >
          <FiLogOut size={18} /> Sign out
        </button>
      </div>
    </aside>
  );
}
