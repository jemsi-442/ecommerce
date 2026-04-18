import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[linear-gradient(150deg,#081B2E_0%,#102A43_55%,#1C4268_100%)] flex items-center justify-center px-4">
      <div className="max-w-xl w-full text-center rounded-3xl border border-white/15 bg-white/10 backdrop-blur-xl p-8 md:p-12 text-white shadow-2xl shadow-black/40">
        <p className="text-sm uppercase tracking-[0.22em] text-orange-200">Error</p>
        <h1 className="mt-2 text-6xl md:text-7xl font-black">404</h1>
        <p className="mt-3 text-slate-200">Page haipo au imeondolewa.</p>
        <Link to="/" className="inline-block mt-7 btn-primary">
          Rudi Home
        </Link>
      </div>
    </div>
  );
}
