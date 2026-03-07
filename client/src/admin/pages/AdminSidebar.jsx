import { NavLink, useNavigate } from "react-router-dom";
import { FiHome, FiShoppingBag, FiPackage, FiUsers, FiBell, FiLogOut } from "react-icons/fi";
import { useAuth } from "../../hooks/useAuth";

const navItems = [
  { name: "Dashboard", path: "/admin", icon: FiHome },
  { name: "Products", path: "/admin/products", icon: FiPackage },
  { name: "Orders", path: "/admin/orders", icon: FiShoppingBag },
  { name: "Users", path: "/admin/users", icon: FiUsers },
  { name: "Notifications", path: "/admin/notifications", icon: FiBell },
];

export default function AdminSidebar({ className = "" }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className={`w-72 min-h-screen flex flex-col border-r border-slate-200 bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] text-slate-200 ${className}`}>
      <div className="px-6 py-6 border-b border-white/10">
        <h1 className="text-xl font-black text-white">Rihan <span className="text-rose-400">Admin</span></h1>
        <p className="text-xs text-slate-400 mt-1 tracking-wide">Control Center</p>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === "/admin"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                  isActive ? "bg-rose-500/20 text-rose-300 border border-rose-400/20" : "text-slate-300 hover:bg-white/5"
                }`
              }
            >
              <Icon size={18} />
              {item.name}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition">
          <FiLogOut size={18} /> Logout
        </button>
      </div>
    </aside>
  );
}
