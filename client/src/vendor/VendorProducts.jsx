import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiEdit,
  FiImage,
  FiMessageSquare,
  FiPackage,
  FiPlus,
  FiTrash2,
  FiXCircle,
} from "react-icons/fi";
import PageState from "../components/PageState";
import axios from "../utils/axios";
import { extractList } from "../utils/apiShape";
import { PLACEHOLDER_IMAGE, resolveImageUrl } from "../utils/image";
import { useToast } from "../hooks/useToast";

const LOW_STOCK_LIMIT = 5;
const defaultForm = {
  name: "",
  description: "",
  price: "",
  stock: "",
  image: "",
};

const statusBadgeClass = (status) => {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
};

const formatReviewMeta = (product) => {
  if (!product.reviewedAt) {
    return "";
  }

  const reviewer = product.reviewer?.name ? ` by ${product.reviewer.name}` : "";
  return `Last reviewed ${new Date(product.reviewedAt).toLocaleString()}${reviewer}`;
};

const getFeedbackMessage = (product) => {
  if (product.status === "approved") {
    return product.reviewNotes || "Approved and now visible in your store.";
  }

  if (product.status === "rejected") {
    return product.reviewNotes || "Returned for changes. Update the product and submit it again.";
  }

  return "Waiting for admin review before it goes live.";
};

export default function VendorProducts() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(PLACEHOLDER_IMAGE);

  const metrics = useMemo(
    () => ({
      total: products.length,
      approved: products.filter((product) => product.status === "approved").length,
      pending: products.filter((product) => product.status === "pending").length,
      rejected: products.filter((product) => product.status === "rejected").length,
      lowStock: products.filter((product) => Number(product.stock || 0) <= LOW_STOCK_LIMIT).length,
    }),
    [products]
  );

  const rejectedProducts = useMemo(
    () => products.filter((product) => product.status === "rejected"),
    [products]
  );

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const resetForm = () => {
    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setEditingProduct(null);
    setForm(defaultForm);
    setImageFile(null);
    setImagePreview(PLACEHOLDER_IMAGE);
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get("/vendor/products");
      setProducts(extractList(data, ["products", "items"]));
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to fetch your products.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const startEditing = (product) => {
    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setEditingProduct(product);
    setForm({
      name: product.name || "",
      description: product.description || "",
      price: product.price || "",
      stock: product.stock || "",
      image: product.image || product.imageUrl || "",
    });
    setImageFile(null);
    setImagePreview(resolveImageUrl(product.images || product.imageUrl || product.image, PLACEHOLDER_IMAGE));
  };

  const handleImageUpload = (file) => {
    if (!file) {
      return;
    }

    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = new FormData();
      payload.append("name", form.name);
      payload.append("description", form.description);
      payload.append("price", Number(form.price));
      payload.append("stock", Number(form.stock));

      if (imageFile) {
        payload.append("image", imageFile);
      } else if (form.image) {
        payload.append("image", form.image);
      }

      if (editingProduct) {
        await axios.put(`/vendor/products/${editingProduct._id}`, payload);
        toast.success("Product updated and sent for review");
      } else {
        await axios.post("/vendor/products", payload);
        toast.success("Product submitted for review");
      }

      resetForm();
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm("Delete this product from your store?")) {
      return;
    }

    try {
      await axios.delete(`/vendor/products/${productId}`);
      toast.success("Product deleted");
      if (editingProduct?._id === productId) {
        resetForm();
      }
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to delete product");
    }
  };

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="rounded-[28px] border border-amber-100 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_48%,#fffbeb_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-500">Store Catalog</p>
          <h1 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">Your Products</h1>
          <p className="text-slate-500">Create, update, and keep track of what is live, waiting for review, or needs changes.</p>
        </div>

        <button type="button" onClick={resetForm} className="btn-primary inline-flex items-center gap-2">
          <FiPlus /> Add Product
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total Products", value: metrics.total, tone: "text-slate-900", icon: FiPackage, accent: "bg-slate-100 text-slate-700" },
          { label: "Approved", value: metrics.approved, tone: "text-emerald-700", icon: FiCheckCircle, accent: "bg-emerald-100 text-emerald-600" },
          { label: "Pending Review", value: metrics.pending, tone: "text-amber-700", icon: FiMessageSquare, accent: "bg-amber-100 text-amber-600" },
          { label: "Needs Changes", value: metrics.rejected, tone: "text-rose-700", icon: FiXCircle, accent: "bg-rose-100 text-rose-600" },
          { label: "Low Stock", value: metrics.lowStock, tone: "text-orange-700", icon: FiAlertTriangle, accent: "bg-orange-100 text-orange-600" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="rounded-[24px] border border-white/80 bg-white/92 p-5 shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                  <p className={`mt-3 text-2xl font-black ${item.tone}`}>{item.value}</p>
                </div>
                <span className={`rounded-2xl p-3 ${item.accent}`}>
                  <Icon size={18} />
                </span>
              </div>
            </article>
          );
        })}
      </section>

      {rejectedProducts.length ? (
        <section className="rounded-[28px] border border-rose-100 bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_100%)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-400">Review Feedback</p>
              <h2 className="mt-1 text-lg font-black text-slate-900">Products that need updates</h2>
              <p className="text-sm text-slate-500">Use the admin notes below, update the listing, and submit it again for review.</p>
            </div>
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
              {rejectedProducts.length} product{rejectedProducts.length === 1 ? "" : "s"} need changes
            </span>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {rejectedProducts.slice(0, 6).map((product) => (
              <article key={product._id} className="rounded-[24px] border border-white/80 bg-white/92 p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
                <div className="flex items-center gap-3">
                  <img
                    src={resolveImageUrl(product.images || product.imageUrl || product.image, PLACEHOLDER_IMAGE)}
                    alt={product.name}
                    onError={(event) => {
                      event.currentTarget.src = PLACEHOLDER_IMAGE;
                    }}
                    className="h-14 w-14 rounded-2xl object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">{product.name}</p>
                    <p className="text-xs text-slate-500">{formatReviewMeta(product) || "Awaiting your resubmission"}</p>
                  </div>
                </div>
                <p className="mt-4 rounded-[20px] border border-rose-100 bg-rose-50/70 p-4 text-sm text-slate-600">
                  {getFeedbackMessage(product)}
                </p>
                <button
                  type="button"
                  onClick={() => startEditing(product)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 font-semibold text-rose-700 transition hover:bg-rose-50"
                >
                  <FiEdit /> Update Product
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/92 shadow-[0_20px_40px_rgba(15,23,42,0.07)]">
          {error ? (
            <div className="p-4">
              <PageState tone="error" title="Products unavailable" description={error} />
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_100%)] text-left text-slate-600">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Stock</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Feedback</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  products.map((product) => {
                    const lowStock = Number(product.stock || 0) <= LOW_STOCK_LIMIT;

                    return (
                      <tr key={product._id} className="border-t border-slate-100 align-top transition hover:bg-amber-50/30">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={resolveImageUrl(product.images || product.imageUrl || product.image, PLACEHOLDER_IMAGE)}
                              alt={product.name}
                              onError={(event) => {
                                event.currentTarget.src = PLACEHOLDER_IMAGE;
                              }}
                              className="h-12 w-12 rounded-xl object-cover"
                            />
                            <div>
                              <p className="font-semibold text-slate-800">{product.name}</p>
                              <p className="text-xs text-slate-500">{product.sku || "SKU pending"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-slate-800">Tsh {Number(product.price).toLocaleString()}</td>
                        <td className="p-3 text-slate-700">
                          <div className="flex items-center gap-2">
                            {product.stock}
                            {lowStock ? <FiAlertTriangle className="text-rose-500" /> : null}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(product.status)}`}>
                            {product.status}
                          </span>
                          {formatReviewMeta(product) ? (
                            <p className="mt-2 text-xs text-slate-400">{formatReviewMeta(product)}</p>
                          ) : null}
                        </td>
                        <td className="p-3">
                          <p className="max-w-xs text-sm text-slate-600">{getFeedbackMessage(product)}</p>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => startEditing(product)}
                              className="rounded-xl border border-sky-200 bg-sky-50 p-2 text-sky-600 transition hover:bg-sky-100"
                              title="Edit product"
                            >
                              <FiEdit />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(product._id)}
                              className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100"
                              title="Delete product"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>

            {loading ? <div className="p-6 text-center text-slate-500">Loading products...</div> : null}
            {!loading && !products.length ? (
              <div className="p-6">
                <PageState
                  tone="info"
                  title="No products yet"
                  description="Add your first product and it will be submitted for admin review."
                />
              </div>
            ) : null}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.06)] md:p-6"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-500">Product Editor</p>
          <h2 className="mt-1 text-xl font-black text-slate-900">{editingProduct ? "Update Product" : "Add Product"}</h2>
          <p className="mt-2 text-sm text-slate-500">
            {editingProduct
              ? "Saving changes sends this product back for admin review."
              : "New products stay pending until admin approves them."}
          </p>

          {editingProduct?.status === "rejected" ? (
            <div className="mt-4 rounded-[24px] border border-rose-100 bg-rose-50/70 p-4 text-sm text-slate-600">
              <p className="font-semibold text-rose-700">Latest admin feedback</p>
              <p className="mt-2">{getFeedbackMessage(editingProduct)}</p>
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            <input
              placeholder="Product name"
              className="input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />

            <textarea
              placeholder="Short product description"
              className="input min-h-[140px]"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="number"
                min="0"
                placeholder="Price"
                className="input"
                value={form.price}
                onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                required
              />
              <input
                type="number"
                min="0"
                placeholder="Stock"
                className="input"
                value={form.stock}
                onChange={(event) => setForm((prev) => ({ ...prev, stock: event.target.value }))}
                required
              />
            </div>

            <input
              type="url"
              placeholder="Image URL (optional if you upload)"
              className="input"
              value={form.image}
              onChange={(event) => setForm((prev) => ({ ...prev, image: event.target.value }))}
            />

            <div className="rounded-[24px] border border-amber-100 bg-amber-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-500">Preview</p>
              <div className="mt-3 overflow-hidden rounded-[22px] border border-white/80 bg-white p-3 shadow-sm">
                <img
                  src={imagePreview || PLACEHOLDER_IMAGE}
                  alt="Preview"
                  className="h-48 w-full rounded-2xl object-cover"
                  onError={(event) => {
                    event.currentTarget.src = PLACEHOLDER_IMAGE;
                  }}
                />
              </div>
              <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-amber-50">
                <FiImage /> Upload image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleImageUpload(event.target.files?.[0])}
                />
              </label>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={resetForm} className="btn-secondary">
              Clear
            </button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? "Saving..." : editingProduct ? "Save Changes" : "Submit Product"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
