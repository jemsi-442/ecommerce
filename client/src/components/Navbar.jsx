import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiMenu, FiShoppingBag, FiX } from "react-icons/fi";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../hooks/useAuth";

export default function Navbar() {
  const { cartCount } = useCart();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = () => {
    closeMenu();
    logout();
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
          Rihan<span className="text-rose-500">Collection</span>
        </Link>

        <button
          className="md:hidden text-slate-700"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <FiX size={22} /> : <FiMenu size={22} />}
        </button>

        <div className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-slate-700 hover:text-rose-600 transition">
            Home
          </Link>

          {user && (
            <>
              <Link to="/shop" className="text-slate-700 hover:text-rose-600 transition">
                Shop
              </Link>

              <Link
                to="/cart"
                className="text-slate-700 hover:text-rose-600 transition flex items-center gap-1"
              >
                <FiShoppingBag /> Cart
                {cartCount > 0 && (
                  <span className="bg-rose-500 text-white text-xs rounded-full px-2 py-0.5">
                    {cartCount}
                  </span>
                )}
              </Link>
            </>
          )}

          {user?.role === "admin" && (
            <Link to="/admin" className="text-rose-600 font-semibold">
              Admin
            </Link>
          )}

          {user?.role === "rider" && (
            <Link to="/rider" className="text-rose-600 font-semibold">
              Rider
            </Link>
          )}

          {!user ? (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-secondary px-4 py-2 rounded-full text-sm">
                Login
              </Link>
              <Link to="/register" className="btn-primary px-4 py-2 rounded-full text-sm">
                Get Started
              </Link>
            </div>
          ) : (
            <button onClick={handleLogout} className="btn-secondary px-4 py-2 rounded-full text-sm">
              Logout
            </button>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t bg-white px-4 py-4 space-y-3">
          <Link onClick={closeMenu} to="/" className="block text-slate-700">
            Home
          </Link>

          {user && (
            <>
              <Link onClick={closeMenu} to="/shop" className="block text-slate-700">
                Shop
              </Link>
              <Link onClick={closeMenu} to="/cart" className="flex items-center gap-2 text-slate-700">
                <FiShoppingBag />
                Cart
                {cartCount > 0 && (
                  <span className="bg-rose-500 text-white text-xs rounded-full px-2 py-0.5">
                    {cartCount}
                  </span>
                )}
              </Link>
            </>
          )}

          {user?.role === "admin" && (
            <Link onClick={closeMenu} to="/admin" className="block text-rose-600 font-medium">
              Admin
            </Link>
          )}

          {user?.role === "rider" && (
            <Link onClick={closeMenu} to="/rider" className="block text-rose-600 font-medium">
              Rider
            </Link>
          )}

          {!user ? (
            <div className="flex gap-2">
              <Link onClick={closeMenu} to="/login" className="flex-1 btn-secondary text-center">
                Login
              </Link>
              <Link onClick={closeMenu} to="/register" className="flex-1 btn-primary text-center">
                Register
              </Link>
            </div>
          ) : (
            <button onClick={handleLogout} className="w-full btn-secondary">
              Logout
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
