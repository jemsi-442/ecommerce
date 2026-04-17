import { NavLink, useNavigate } from "react-router-dom";
import {
  FiCreditCard,
  FiGrid,
  FiLogOut,
  FiPackage,
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
      className={`w-72 min-h-screen flex flex-col border-r border-amber-100/30 bg-[linear-gradient(180deg,#1f2937_0%,#111827_46%,#172554_100%)] text-slate-200 ${className}`}
    >
      <div className="flex items-start justify-between border-b border-white/10 px-6 py-6">
        <div>
          <h1 className="text-xl font-black text-white">
            Ecommerce <span className="text-amber-300">Vendor</span>
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
            <div className="rounded-2xl bg-amber-400/15 p-3 text-amber-300">
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
                    ? "border border-amber-300/20 bg-amber-400/15 text-amber-200"
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
