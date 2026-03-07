import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiFilter, FiSearch, FiHeart, FiShoppingBag } from "react-icons/fi";
import api from "../utils/axios";
import { extractList } from "../utils/apiShape";
import { useCart } from "../hooks/useCart";
import { PLACEHOLDER_IMAGE, resolveImageUrl } from "../utils/image";
import { ProductGridSkeleton } from "../components/Skeleton";
import { useToast } from "../hooks/useToast";

const PRICE_RANGES = [
  { label: "All Prices", value: "all" },
  { label: "Under 50,000", value: "0-50000" },
  { label: "50,000 - 100,000", value: "50000-100000" },
  { label: "100,000+", value: "100000-10000000" },
];

export default function Shop() {
  const { addToCart } = useCart();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [price, setPrice] = useState("all");
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/products?status=approved");
        const rawProducts = extractList(data, ["products", "items"]);

        const normalizedProducts = rawProducts.map((p) => ({
          ...p,
          image: resolveImageUrl([p.imageUrl, p.image, ...(p.images || [])], PLACEHOLDER_IMAGE),
          countInStock:
            typeof p.countInStock === "number"
              ? p.countInStock
              : typeof p.stock === "number"
                ? p.stock
                : 0,
        }));

        setProducts(normalizedProducts);
      } catch (err) {
        setError("Imeshindikana kupakia bidhaa.");
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => (p.name || "").toLowerCase().includes(search.toLowerCase()))
      .filter((p) => {
        if (price === "all") return true;
        const [min, max] = price.split("-").map(Number);
        return Number(p.price) >= min && Number(p.price) <= max;
      })
      .filter((p) => (inStockOnly ? p.countInStock > 0 : true));
  }, [products, search, price, inStockOnly]);

  const handleAddToCart = (product) => {
    if (product.countInStock <= 0) return;

    addToCart({
      productId: product._id,
      name: product.name,
      price: Number(product.price),
      image: product.image,
      qty: 1,
      stock: product.countInStock,
      variant: null,
    });

    toast.success(`${product.name} added to cart`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-[linear-gradient(130deg,#0f172a_0%,#1e1b4b_45%,#be185d_100%)] text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-14">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Private Shop Collection</h1>
          <p className="mt-2 text-rose-100 max-w-2xl">
            Chagua bidhaa maridadi zilizopo kwenye curated catalog yako.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 md:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-200 focus:border-rose-300 outline-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <div className="flex items-center gap-2 text-slate-600 text-sm px-3">
              <FiFilter /> Filters
            </div>
            <select
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white min-w-44"
            >
              {PRICE_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-700">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={() => setInStockOnly((v) => !v)}
                className="accent-rose-500"
              />
              In stock only
            </label>
          </div>
        </div>

        <div className="mt-5 text-sm text-slate-500">Showing {filteredProducts.length} product(s)</div>

        {loading && <div className="mt-6"><ProductGridSkeleton count={6} /></div>}

        {error && <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">{error}</div>}

        {!loading && !error && filteredProducts.length === 0 && (
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            Hakuna bidhaa zinazolingana na search/filter ulizoweka.
          </div>
        )}

        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7">
          {filteredProducts.map((p, i) => (
            <motion.article
              key={p._id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition"
            >
              <div className="relative aspect-[4/5] bg-slate-100">
                <img
                  src={p.image}
                  alt={p.name}
                  onError={(e) => {
                    e.currentTarget.src = PLACEHOLDER_IMAGE;
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <button
                  aria-label="Add to favorites"
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 border border-slate-200 text-slate-600 hover:text-rose-500"
                >
                  <FiHeart className="mx-auto" />
                </button>
              </div>

              <div className="p-4 md:p-5">
                <h3 className="font-bold text-lg text-slate-900 line-clamp-1">{p.name}</h3>
                <p className="mt-1 text-rose-600 font-extrabold">TZS {Number(p.price).toLocaleString()}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {p.countInStock > 0 ? `${p.countInStock} in stock` : "Out of stock"}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    to={`/product/${p._id}`}
                    className="text-center py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => handleAddToCart(p)}
                    disabled={p.countInStock === 0}
                    className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <FiShoppingBag /> Add
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </div>
  );
}
