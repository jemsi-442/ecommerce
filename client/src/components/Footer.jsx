import { Link, useLocation } from "react-router-dom";

function CompactFooter() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white/90 px-4 py-5 text-center">
      <p className="text-xs font-medium tracking-[0.14em] text-slate-500">
        © 2026 Ecommerce. All rights reserved.
      </p>
    </footer>
  );
}

function FullFooter() {
  return (
    <footer className="mt-16 border-t border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.3fr_0.8fr_1fr]">
        <div className="max-w-md">
          <Link to="/" className="text-2xl font-black tracking-tight text-white">
            Ecom<span className="text-rose-500">merce</span>
          </Link>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            A modern shopping experience with quality products, secure checkout, and reliable delivery.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
            Quick Links
          </p>
          <div className="mt-4 flex flex-col gap-3 text-sm text-slate-300">
            <Link to="/" className="transition hover:text-white">
              Home
            </Link>
            <Link to="/shop" className="transition hover:text-white">
              Shop
            </Link>
            <Link to="/cart" className="transition hover:text-white">
              Cart
            </Link>
            <Link to="/orders" className="transition hover:text-white">
              Orders
            </Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
            Contact
          </p>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <p>support@ecommerce.com</p>
            <p>+255 713 551 801</p>
            <p>Dar es Salaam, Tanzania</p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800 px-6 py-4 text-center">
        <p className="text-xs font-medium tracking-[0.14em] text-slate-400">
          © 2026 Ecommerce. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default function Footer() {
  const { pathname } = useLocation();
  const isCompact = pathname === "/shop";

  return isCompact ? <CompactFooter /> : <FullFooter />;
}
