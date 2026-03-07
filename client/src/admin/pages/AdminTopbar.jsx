import { FiBell, FiLogOut, FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function AdminTopbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="h-16 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center justify-between px-4 md:px-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin</p>
        <p className="text-base md:text-lg font-bold text-slate-900">Dashboard</p>
      </div>

      <div className="flex items-center gap-3 md:gap-5">
        <button className="relative text-slate-600 hover:text-slate-900 transition" aria-label="Notifications">
          <FiBell size={20} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-slate-700">
          <FiUser />
          <span className="text-sm font-medium">{user?.name || "Admin"}</span>
        </div>

        <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-slate-600 hover:text-rose-600 transition">
          <FiLogOut />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
