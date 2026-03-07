import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { FiHome, FiTruck, FiLogOut } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";

export default function RiderLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="w-72 bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] text-slate-200 border-r border-white/10 p-6 hidden md:block">
        <h2 className="text-2xl font-black text-white">Rider Panel</h2>
        <p className="text-xs text-slate-400 mt-1">Delivery workspace</p>

        <nav className="mt-8 space-y-2">
          <NavLink to="/rider" end className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl ${isActive ? "bg-rose-500/20 text-rose-300" : "hover:bg-white/5"}`}>
            <FiHome /> Dashboard
          </NavLink>
          <NavLink to="/rider/orders" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl ${isActive ? "bg-rose-500/20 text-rose-300" : "hover:bg-white/5"}`}>
            <FiTruck /> Orders
          </NavLink>
        </nav>

        <button onClick={onLogout} className="mt-8 w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5">
          <FiLogOut /> Logout
        </button>
      </aside>

      <main className="flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
