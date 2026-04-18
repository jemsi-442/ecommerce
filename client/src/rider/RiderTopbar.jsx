import { FiMenu, FiTruck, FiUser } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";

export default function RiderTopbar({ onOpenSidebar }) {
  const { user } = useAuth();
  const initial = (user?.name || "Rider").trim().charAt(0).toUpperCase() || "R";

  return (
    <header className="sticky top-0 z-30 relative flex h-20 items-center justify-between overflow-hidden border-b border-white/70 bg-[linear-gradient(135deg,rgba(248,250,252,0.97)_0%,rgba(239,246,255,0.96)_44%,rgba(255,247,237,0.95)_100%)] px-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl md:px-6">
      <div className="pointer-events-none absolute inset-y-0 right-[-8%] w-[42%] bg-[radial-gradient(circle_at_center,rgba(242,140,40,0.14)_0%,rgba(242,140,40,0)_72%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(16,42,67,0)_0%,rgba(16,42,67,0.78)_28%,rgba(242,140,40,0.72)_64%,rgba(242,140,40,0)_100%)]" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-2xl border border-white/80 bg-white/75 p-2.5 text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:bg-white lg:hidden"
          aria-label="Open sidebar"
        >
          <FiMenu size={18} />
        </button>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Delivery Console</p>
          <div className="flex items-center gap-3">
            <p className="text-base font-black text-slate-900 md:text-lg">Rider Operations</p>
            <span className="hidden rounded-full border border-white/80 bg-white/65 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-sm md:inline-flex">
              Live queue
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-5">
        <div className="hidden items-center gap-3 rounded-full border border-white/80 bg-white/72 px-3 py-2 text-slate-700 shadow-[0_14px_34px_rgba(15,23,42,0.08)] sm:flex">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#102A43_0%,#F28C28_100%)] text-sm font-black text-white">
            {initial}
          </span>
          <div className="leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">On shift</p>
            <p className="text-sm font-semibold text-slate-900">{user?.name || "Rider"}</p>
          </div>
          <FiUser className="text-[#102A43]" />
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-white/80 bg-white/72 px-3 py-2 text-slate-700 shadow-[0_14px_34px_rgba(15,23,42,0.08)] md:flex">
          <FiTruck className="text-orange-500" />
          <span className="text-sm font-medium">Deliveries, history, and shift control</span>
        </div>
      </div>
    </header>
  );
}
