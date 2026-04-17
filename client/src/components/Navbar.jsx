import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiBell, FiHeart, FiMenu, FiSearch, FiShoppingBag, FiX } from "react-icons/fi";
import api from "../utils/axios";
import { extractList } from "../utils/apiShape";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../hooks/useAuth";
import useNotificationAlerts from "../hooks/useNotificationAlerts";
import useNotificationPreferences from "../hooks/useNotificationPreferences";
import useNotificationSummary from "../hooks/useNotificationSummary";
import { useSavedProducts } from "../hooks/useSavedProducts";

function MarketplaceSearch({
  search,
  setSearch,
  searchOpen,
  setSearchOpen,
  productMatches,
  storeMatches,
  onSubmit,
  onSelectProduct,
  onSelectStore,
  className = "",
}) {
  const hasResults = productMatches.length > 0 || storeMatches.length > 0;

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={onSubmit} className="relative">
        <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
          placeholder="Search products or stores"
          className="w-full rounded-full border border-slate-300 bg-white/95 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
        />
      </form>

      {searchOpen && search.trim() ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.6rem)] z-50 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_55px_rgba(15,23,42,0.14)]">
          {storeMatches.length ? (
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Stores</p>
              <div className="mt-3 space-y-2">
                {storeMatches.map((store) => (
                  <button
                    key={store.slug}
                    type="button"
                    onClick={() => onSelectStore(store)}
                    className="flex w-full items-center justify-between rounded-2xl border border-transparent bg-slate-50 px-4 py-3 text-left transition hover:border-amber-200 hover:bg-amber-50"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{store.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{store.itemCount} live product{store.itemCount === 1 ? "" : "s"}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">Store</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {productMatches.length ? (
            <div className="px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Products</p>
              <div className="mt-3 space-y-2">
                {productMatches.map((product) => (
                  <button
                    key={product._id}
                    type="button"
                    onClick={() => onSelectProduct(product)}
                    className="flex w-full items-center justify-between rounded-2xl border border-transparent bg-slate-50 px-4 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{product.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {product.vendor?.storeName || product.vendor?.name || "Marketplace seller"}
                      </p>
                    </div>
                    <span className="ml-3 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                      TZS {Number(product.price || 0).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!hasResults ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No product or store matches that search yet.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function Navbar() {
  const { cartCount } = useCart();
  const { savedCount } = useSavedProducts();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const notificationPreferences = useNotificationPreferences("customer");
  const notificationSummary = useNotificationSummary({
    enabled: user?.role === "user" || user?.role === "customer",
    mode: "customer",
  });
  const { unreadCount } = notificationSummary;

  useNotificationAlerts({
    enabled: user?.role === "user" || user?.role === "customer",
    mode: "customer",
    soundEnabled: notificationPreferences.soundEnabled,
    vibrationEnabled: notificationPreferences.vibrationEnabled,
  });

  useEffect(() => {
    let active = true;

    const loadCatalog = async () => {
      try {
        const { data } = await api.get("/products?status=approved");
        const items = extractList(data, ["products", "items"]);
        if (active) {
          setCatalog(items);
        }
      } catch {
        if (active) {
          setCatalog([]);
        }
      }
    };

    loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  const stores = useMemo(() => {
    const storeMap = new Map();

    catalog.forEach((product) => {
      const slug = product.vendor?.storeSlug;
      if (!slug) {
        return;
      }

      const current = storeMap.get(slug) || {
        slug,
        name: product.vendor.storeName || product.vendor.name || slug,
        itemCount: 0,
      };
      current.itemCount += 1;
      storeMap.set(slug, current);
    });

    return Array.from(storeMap.values());
  }, [catalog]);

  const searchTerm = search.trim().toLowerCase();

  const productMatches = useMemo(() => {
    if (!searchTerm) {
      return [];
    }

    return catalog
      .filter((product) =>
        [product.name, product.description, product.vendor?.storeName, product.vendor?.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(searchTerm))
      )
      .slice(0, 4);
  }, [catalog, searchTerm]);

  const storeMatches = useMemo(() => {
    if (!searchTerm) {
      return [];
    }

    return stores
      .filter((store) => String(store.name || "").toLowerCase().includes(searchTerm))
      .slice(0, 3);
  }, [searchTerm, stores]);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = () => {
    closeMenu();
    logout();
    navigate("/");
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (!search.trim()) {
      return;
    }

    setSearchOpen(false);
    closeMenu();

    if (!user) {
      navigate("/login");
      return;
    }

    navigate(`/shop?search=${encodeURIComponent(search.trim())}`);
  };

  const handleSelectProduct = (product) => {
    setSearch("");
    setSearchOpen(false);
    closeMenu();

    if (!user) {
      navigate("/login");
      return;
    }

    navigate(`/product/${product._id}`);
  };

  const handleSelectStore = (store) => {
    setSearch("");
    setSearchOpen(false);
    closeMenu();
    navigate(`/stores/${store.slug}`);
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 md:px-6">
        <Link to="/" className="text-xl font-black tracking-tight text-slate-900 md:text-2xl">
          Ecom<span className="text-rose-500">merce</span>
        </Link>

        <div className="hidden md:block">
          <MarketplaceSearch
            search={search}
            setSearch={setSearch}
            searchOpen={searchOpen}
            setSearchOpen={setSearchOpen}
            productMatches={productMatches}
            storeMatches={storeMatches}
            onSubmit={handleSearchSubmit}
            onSelectProduct={handleSelectProduct}
            onSelectStore={handleSelectStore}
            className="mx-auto max-w-xl"
          />
        </div>

        <button
          className="justify-self-end text-slate-700 md:hidden"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <FiX size={22} /> : <FiMenu size={22} />}
        </button>

        <div className="hidden items-center gap-6 md:flex">
          <Link to="/" className="text-slate-700 transition hover:text-rose-600">
            Home
          </Link>

          {user && (
            <>
              <Link to="/shop" className="text-slate-700 transition hover:text-rose-600">
                Shop
              </Link>

              {(user?.role === "user" || user?.role === "customer") && (
                <>
                  <Link
                    to="/account"
                    className="flex items-center gap-1 text-slate-700 transition hover:text-rose-600"
                  >
                    <FiBell /> Account
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs text-white">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/account#wishlist"
                    className="flex items-center gap-1 text-slate-700 transition hover:text-rose-600"
                  >
                    <FiHeart /> Saved
                    {savedCount > 0 && (
                      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
                        {savedCount}
                      </span>
                    )}
                  </Link>
                </>
              )}

              <Link
                to="/cart"
                className="flex items-center gap-1 text-slate-700 transition hover:text-rose-600"
              >
                <FiShoppingBag /> Cart
                {cartCount > 0 && (
                  <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
                    {cartCount}
                  </span>
                )}
              </Link>
            </>
          )}

          {user?.role === "admin" && (
            <Link to="/admin" className="font-semibold text-rose-600">
              Admin
            </Link>
          )}

          {user?.role === "vendor" && (
            <Link to="/vendor" className="font-semibold text-amber-600">
              Vendor
            </Link>
          )}

          {user?.role === "rider" && (
            <Link to="/rider" className="font-semibold text-rose-600">
              Rider
            </Link>
          )}

          {!user ? (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-secondary rounded-full px-4 py-2 text-sm">
                Login
              </Link>
              <Link to="/register" className="btn-primary rounded-full px-4 py-2 text-sm">
                Get Started
              </Link>
            </div>
          ) : (
            <button onClick={handleLogout} className="btn-secondary rounded-full px-4 py-2 text-sm">
              Logout
            </button>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className="space-y-4 border-t bg-white px-4 py-4 md:hidden">
          <MarketplaceSearch
            search={search}
            setSearch={setSearch}
            searchOpen={searchOpen}
            setSearchOpen={setSearchOpen}
            productMatches={productMatches}
            storeMatches={storeMatches}
            onSubmit={handleSearchSubmit}
            onSelectProduct={handleSelectProduct}
            onSelectStore={handleSelectStore}
          />

          <Link onClick={closeMenu} to="/" className="block text-slate-700">
            Home
          </Link>

          {user && (
            <>
              <Link onClick={closeMenu} to="/shop" className="block text-slate-700">
                Shop
              </Link>
              {(user?.role === "user" || user?.role === "customer") && (
                <>
                  <Link
                    onClick={closeMenu}
                    to="/account"
                    className="flex items-center gap-2 text-slate-700"
                  >
                    <FiBell />
                    Account
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs text-white">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                  <Link
                    onClick={closeMenu}
                    to="/account#wishlist"
                    className="flex items-center gap-2 text-slate-700"
                  >
                    <FiHeart />
                    Saved
                    {savedCount > 0 && (
                      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
                        {savedCount}
                      </span>
                    )}
                  </Link>
                </>
              )}
              <Link onClick={closeMenu} to="/cart" className="flex items-center gap-2 text-slate-700">
                <FiShoppingBag />
                Cart
                {cartCount > 0 && (
                  <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
                    {cartCount}
                  </span>
                )}
              </Link>
            </>
          )}

          {user?.role === "admin" && (
            <Link onClick={closeMenu} to="/admin" className="block font-medium text-rose-600">
              Admin
            </Link>
          )}

          {user?.role === "vendor" && (
            <Link onClick={closeMenu} to="/vendor" className="block font-medium text-amber-600">
              Vendor
            </Link>
          )}

          {user?.role === "rider" && (
            <Link onClick={closeMenu} to="/rider" className="block font-medium text-rose-600">
              Rider
            </Link>
          )}

          {!user ? (
            <div className="flex gap-2">
              <Link onClick={closeMenu} to="/login" className="btn-secondary flex-1 text-center">
                Login
              </Link>
              <Link onClick={closeMenu} to="/register" className="btn-primary flex-1 text-center">
                Register
              </Link>
            </div>
          ) : (
            <button onClick={handleLogout} className="btn-secondary w-full">
              Logout
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
