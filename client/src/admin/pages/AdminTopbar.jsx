import { FiBell, FiLogOut, FiMenu, FiUser } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function AdminTopbar({ unreadCount = 0, onOpenSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="relative flex h-16 items-center justify-between overflow-hidden border-b border-emerald-100/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.98)_0%,rgba(236,253,245,0.96)_44%,rgba(239,246,255,0.98)_100%)] px-4 backdrop-blur md:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(16,185,129,0)_0%,rgba(16,185,129,0.7)_25%,rgba(245,158,11,0.7)_58%,rgba(14,165,233,0.55)_82%,rgba(14,165,233,0)_100%)]" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-xl border border-emerald-100 bg-white/80 p-2 text-slate-700 shadow-sm transition hover:bg-white lg:hidden"
          aria-label="Open sidebar"
        >
          <FiMenu size={18} />
        </button>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-600">Marketplace Console</p>
          <p className="text-base font-black text-slate-900 md:text-lg">Commerce Overview</p>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-5">
        <Link
          to="/admin/notifications"
          className="relative rounded-full border border-white/80 bg-white/75 p-2 text-slate-600 shadow-sm transition hover:text-slate-900"
          aria-label="Marketplace updates"
        >
          <FiBell size={20} />
          {unreadCount > 0 ? (
            <span className="absolute -right-2 -top-2 min-w-[18px] rounded-full bg-[linear-gradient(135deg,#10b981_0%,#f59e0b_100%)] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-emerald-400/30">
              {unreadCount}
            </span>
          ) : null}
        </Link>

        <div className="hidden items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-slate-700 shadow-sm sm:flex">
          <FiUser className="text-emerald-600" />
          <span className="text-sm font-medium">{user?.name || "Marketplace Lead"}</span>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-full border border-transparent px-2 py-1 text-sm text-slate-600 transition hover:border-emerald-100 hover:bg-white/65 hover:text-emerald-700"
        >
          <FiLogOut />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
