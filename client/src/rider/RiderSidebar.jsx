import { NavLink, useNavigate } from "react-router-dom";
import { FiClock, FiGrid, FiLogOut, FiSettings, FiTruck, FiX } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";

const navItems = [
  { name: "Overview", path: "/rider", icon: FiGrid },
  { name: "Orders", path: "/rider/orders", icon: FiTruck },
  { name: "History", path: "/rider/history", icon: FiClock },
  { name: "Profile", path: "/rider/profile", icon: FiSettings },
];

export default function RiderSidebar({ className = "", mobile = false, onNavigate, onClose }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
    onNavigate?.();
  };

  return (
    <aside
      className={`sticky top-0 flex h-screen w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-900/10 bg-[linear-gradient(180deg,#0f172a_0%,#172554_52%,#1e293b_100%)] text-slate-200 ${className}`}
    >
      <div className="flex items-start justify-between border-b border-white/10 px-6 py-6">
        <div>
          <h1 className="text-xl font-black text-white">
            Ecommerce <span className="text-orange-300">Rider</span>
          </h1>
          <p className="mt-1 text-xs tracking-wide text-slate-400">
            {user?.name || "Delivery workspace"}
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
              <FiTruck size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Shift</p>
              <p className="text-sm font-semibold text-white">Deliver, confirm, and move fast</p>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 px-4 py-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === "/rider"}
              onClick={() => onNavigate?.()}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
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

      <div className="border-t border-white/10 px-4 py-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5"
        >
          <FiLogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
