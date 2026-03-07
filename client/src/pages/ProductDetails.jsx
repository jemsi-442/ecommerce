import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiShoppingBag, FiMinus, FiPlus, FiCheckCircle, FiXCircle } from "react-icons/fi";
import { useParams } from "react-router-dom";
import api from "../utils/axios";
import { extractOne } from "../utils/apiShape";
import { useCart } from "../hooks/useCart";
import { PLACEHOLDER_IMAGE, resolveImageUrl } from "../utils/image";
import { useToast } from "../hooks/useToast";

export default function ProductDetails() {
  const { addToCart } = useCart();
  const toast = useToast();
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/products/${id}`);
        const productData = extractOne(data);

        const normalized = {
          ...productData,
          images: (productData.images || []).map((img) => resolveImageUrl(img, "")).filter(Boolean),
          image: resolveImageUrl(
            [productData.imageUrl, productData.image, ...(productData.images || [])],
            PLACEHOLDER_IMAGE
          ),
          countInStock:
            typeof productData.countInStock === "number"
              ? productData.countInStock
              : typeof productData.stock === "number"
                ? productData.stock
                : 0,
        };

        setProduct(normalized);
        setSelectedVariant(normalized.variants?.[0] || null);
      } catch (err) {
        setError("Imeshindikana kupakia bidhaa.");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const availableStock = useMemo(() => {
    if (!product) return 0;
    if (selectedVariant) return selectedVariant.stock;
    return product.countInStock || 0;
  }, [product, selectedVariant]);

  const handleAddToCart = () => {
    addToCart({
      productId: product._id,
      name: product.name,
      price: Number(selectedVariant?.price || product.price),
      image: product.images?.[0] || product.image,
      qty,
      stock: availableStock,
      variant: selectedVariant,
    });
    toast.success("Product added to cart");
  };

  if (loading) return <div className="py-28 text-center text-slate-500">Inapakia bidhaa...</div>;

  if (error || !product) {
    return <div className="py-28 text-center text-red-500">{error || "Bidhaa haijapatikana"}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 md:px-6 py-8 md:py-12">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-7 md:gap-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl overflow-hidden bg-slate-100">
            <img
              src={product.images?.[activeImage] || product.image}
              alt={product.name}
              onError={(e) => {
                e.currentTarget.src = PLACEHOLDER_IMAGE;
              }}
              className="w-full aspect-square object-cover"
            />
          </motion.div>

          {product.images?.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {product.images.map((img, i) => (
                <button
                  aria-label="View image thumbnail"
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 ${activeImage === i ? "border-rose-500" : "border-slate-200"}`}
                >
                  <img
                    src={img}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER_IMAGE;
                    }}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-7 shadow-sm">
          <h1 className="text-3xl font-black text-slate-900">{product.name}</h1>
          <p className="mt-2 text-2xl font-black text-rose-600">TZS {Number(selectedVariant?.price || product.price).toLocaleString()}</p>

          <p className="mt-4 text-slate-600 leading-relaxed">{product.description}</p>

          {product.variants?.length > 0 && (
            <div className="mt-7">
              <h3 className="font-bold text-slate-900 mb-2">Variant</h3>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v._id}
                    onClick={() => setSelectedVariant(v)}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium ${selectedVariant?._id === v._id ? "bg-rose-500 text-white border-rose-500" : "bg-white text-slate-700 border-slate-300 hover:border-rose-300"}`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 inline-flex items-center gap-2 text-sm">
            {availableStock > 0 ? (
              <>
                <FiCheckCircle className="text-emerald-500" />
                <span className="text-emerald-700">{availableStock} in stock</span>
              </>
            ) : (
              <>
                <FiXCircle className="text-red-500" />
                <span className="text-red-600">Out of stock</span>
              </>
            )}
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="inline-flex items-center border border-slate-300 rounded-xl overflow-hidden">
              <button aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2 hover:bg-slate-100">
                <FiMinus />
              </button>
              <span className="px-4 font-semibold text-slate-800">{qty}</span>
              <button aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(availableStock, q + 1))} className="px-3 py-2 hover:bg-slate-100">
                <FiPlus />
              </button>
            </div>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={availableStock === 0}
            className="mt-7 w-full sm:w-auto inline-flex items-center justify-center gap-2 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiShoppingBag /> Add to Cart
          </button>
        </section>
      </div>
    </div>
  );
}
