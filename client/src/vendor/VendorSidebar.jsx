import { NavLink, useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiCreditCard,
  FiGrid,
  FiLogOut,
  FiPackage,
  FiTruck,
  FiSettings,
  FiShoppingBag,
  FiHome,
  FiX,
} from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";

const navItems = [
  { name: "Overview", path: "/vendor", icon: FiGrid },
  { name: "Products", path: "/vendor/products", icon: FiPackage },
  { name: "Orders", path: "/vendor/orders", icon: FiShoppingBag },
  { name: "Delivery Issues", path: "/vendor/delivery-issues", icon: FiAlertCircle },
  { name: "Riders", path: "/vendor/riders", icon: FiTruck },
  { name: "Payouts", path: "/vendor/payouts", icon: FiCreditCard },
  { name: "Store Profile", path: "/vendor/profile", icon: FiSettings },
];

export default function VendorSidebar({ className = "", mobile = false, onNavigate, onClose }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
    onNavigate?.();
  };

  return (
    <aside
      className={`sticky top-0 flex h-screen w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-900/10 bg-[linear-gradient(180deg,#0f172a_0%,#172554_48%,#1e293b_100%)] text-slate-200 ${className}`}
    >
      <div className="flex items-start justify-between border-b border-white/10 px-6 py-6">
        <div>
          <h1 className="text-xl font-black text-white">
            Ecommerce <span className="text-orange-300">Vendor</span>
          </h1>
          <p className="mt-1 text-xs tracking-wide text-slate-400">
            {user?.storeName || "Seller workspace"}
          </p>
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

      <div className="px-4 pt-5">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_16px_30px_rgba(15,23,42,0.2)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-orange-400/15 p-3 text-orange-300">
              <FiHome size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Store</p>
              <p className="text-sm font-semibold text-white">Build, review, and sell</p>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === "/vendor"}
              onClick={() => onNavigate?.()}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? "border border-orange-300/20 bg-orange-400/15 text-orange-200"
                    : "text-slate-300 hover:bg-white/5"
                }`
              }
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition"
        >
          <FiLogOut size={18} /> Logout
        </button>
      </div>
    </aside>
  );
}
