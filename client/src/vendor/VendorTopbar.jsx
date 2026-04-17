import { FiMenu, FiPackage, FiUser } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";

export default function VendorTopbar({ onOpenSidebar }) {
  const { user } = useAuth();

  return (
    <header className="relative flex h-16 items-center justify-between overflow-hidden border-b border-amber-100/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(255,251,235,0.96)_48%,rgba(255,247,237,0.96)_100%)] px-4 backdrop-blur md:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(245,158,11,0)_0%,rgba(245,158,11,0.75)_36%,rgba(251,113,133,0.55)_72%,rgba(251,113,133,0)_100%)]" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-xl border border-amber-100 bg-white/80 p-2 text-slate-700 shadow-sm transition hover:bg-white lg:hidden"
          aria-label="Open sidebar"
        >
          <FiMenu size={18} />
        </button>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-500">
            Vendor Space
          </p>
          <p className="text-base font-black text-slate-900 md:text-lg">Store Operations</p>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <div className="hidden items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-slate-700 shadow-sm sm:flex">
          <FiPackage />
          <span className="text-sm font-medium">Your catalog, your orders</span>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-slate-700 shadow-sm sm:flex">
          <FiUser />
          <span className="text-sm font-medium">{user?.name || "Vendor"}</span>
        </div>
      </div>
    </header>
  );
}
