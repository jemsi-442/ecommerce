import { Link } from "react-router-dom";
import { FiMail, FiMapPin, FiPhone } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";

export default function Footer() {
  const { user } = useAuth();

  return (
    <footer className="mt-16 border-t border-slate-800 bg-[linear-gradient(160deg,#020617_0%,#0f172a_50%,#111827_100%)] text-slate-200">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 grid md:grid-cols-3 gap-8 md:gap-12">
        <div>
          <h3 className="text-2xl font-black tracking-tight text-white">
            Rihan<span className="text-rose-400">Collection</span>
          </h3>
          <p className="mt-3 text-slate-300 leading-relaxed">
            Premium shopping experience kwa wanawake wa kisasa. Quality products, secure checkout, na delivery ya uhakika.
          </p>
        </div>

        <div>
          <h4 className="text-sm uppercase tracking-[0.2em] text-rose-300 mb-4">Quick Links</h4>
          <ul className="space-y-2 text-slate-300">
            <li><Link to="/" className="hover:text-white transition">Home</Link></li>
            {user ? (
              <>
                <li><Link to="/shop" className="hover:text-white transition">Shop</Link></li>
                <li><Link to="/cart" className="hover:text-white transition">Cart</Link></li>
                <li><Link to="/orders" className="hover:text-white transition">Orders</Link></li>
              </>
            ) : (
              <>
                <li><Link to="/register" className="hover:text-white transition">Register</Link></li>
                <li><Link to="/login" className="hover:text-white transition">Login</Link></li>
              </>
            )}
          </ul>
        </div>

        <div>
          <h4 className="text-sm uppercase tracking-[0.2em] text-rose-300 mb-4">Contact</h4>
          <ul className="space-y-3 text-slate-300">
            <li className="flex items-center gap-2"><FiMail className="text-rose-300" /> support@rihancollection.com</li>
            <li className="flex items-center gap-2"><FiPhone className="text-rose-300" /> +255 713 551 801</li>
            <li className="flex items-center gap-2"><FiMapPin className="text-rose-300" /> Dar es Salaam, Tanzania</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center text-sm text-slate-400">
        &copy; {new Date().getFullYear()} RihanCollection. All rights reserved.
      </div>
    </footer>
  );
}
