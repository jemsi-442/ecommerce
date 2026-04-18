import { useEffect, useMemo, useState } from "react";
import axios from "../../utils/axios";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiEdit,
  FiImage,
  FiMessageSquare,
  FiPackage,
  FiPlus,
  FiShield,
  FiTrash2,
  FiXCircle,
} from "react-icons/fi";
import { extractList } from "../../utils/apiShape";
import { PLACEHOLDER_IMAGE, resolveImageUrl } from "../../utils/image";
import PageState from "../../components/PageState";
import { useToast } from "../../hooks/useToast";
import { getProductReviewStatusTone } from "../../utils/statusStyles";

const LOW_STOCK_LIMIT = 5;

const formatReviewDate = (value) => {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
};

const buildReviewSummary = (product) => {
  if (product.status === "approved") {
    return product.reviewNotes || "Approved and live for customers.";
  }

  if (product.status === "rejected") {
    return product.reviewNotes || "Returned to the vendor for updates.";
  }

  return "Waiting for an admin decision before it goes live.";
};

export default function AdminProducts() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [error, setError] = useState("");
  const [reviewProduct, setReviewProduct] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get("/products");
      setProducts(extractList(data, ["products", "items"]));
      setError("");
    } catch (err) {
      console.error("Fetch products error:", err.response?.data || err.message);
      setError("Failed to fetch products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const metrics = useMemo(
    () => ({
      total: products.length,
      pendingReview: products.filter((product) => product.status === "pending").length,
      approved: products.filter((product) => product.status === "approved").length,
      rejected: products.filter((product) => product.status === "rejected").length,
      lowStock: products.filter((product) => Number(product.stock || 0) <= LOW_STOCK_LIMIT).length,
    }),
    [products]
  );

  const pendingVendorQueue = useMemo(
    () => products.filter((product) => product.status === "pending" && product.vendor?.storeSlug),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      if (normalizedQuery) {
        const searchableText = [
          product.name,
          product.sku,
          product.vendor?.storeName,
          product.vendor?.name,
          product.vendor?.storeSlug,
          product.reviewNotes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(normalizedQuery)) {
          return false;
        }
      }

      if (statusFilter !== "all" && product.status !== statusFilter) {
        return false;
      }

      if (stockFilter === "low" && Number(product.stock || 0) > LOW_STOCK_LIMIT) {
        return false;
      }

      if (stockFilter === "out" && Number(product.stock || 0) > 0) {
        return false;
      }

      if (sourceFilter === "vendor" && !product.vendor?.storeSlug) {
        return false;
      }

      if (sourceFilter === "platform" && product.vendor?.storeSlug) {
        return false;
      }

      return true;
    });
  }, [products, searchQuery, sourceFilter, statusFilter, stockFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, searchQuery, sourceFilter, statusFilter, stockFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredProducts.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredProducts, pageSize]);

  const paginationLabel = useMemo(() => {
    if (!filteredProducts.length) {
      return "Showing 0 results";
    }

    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, filteredProducts.length);
    return `Showing ${start}-${end} of ${filteredProducts.length}`;
  }, [currentPage, filteredProducts.length, pageSize]);

  const openReviewModal = (product) => {
    setReviewProduct(product);
    setReviewNotes(product.reviewNotes || "");
  };

  const closeReviewModal = () => {
    setReviewProduct(null);
    setReviewNotes("");
    setReviewSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product?")) return;

    try {
      await axios.delete(`/products/${id}`);
      toast.success("Product deleted");
      fetchProducts();
    } catch (err) {
      console.error("Delete error:", err.response?.data || err.message);
      toast.error(err.response?.data?.message || "Failed to delete product");
    }
  };

  const submitReview = async (action) => {
    if (!reviewProduct?._id) {
      return;
    }

    if (action === "reject" && reviewNotes.trim().length < 8) {
      toast.error("Add a clear reason before sending the product back");
      return;
    }

    try {
      setReviewSubmitting(true);
      await axios.put(`/products/${reviewProduct._id}/${action}`, {
        reviewNotes,
      });
      toast.success(action === "approve" ? "Product approved" : "Feedback sent to vendor");
      closeReviewModal();
      fetchProducts();
    } catch (err) {
      console.error("Review error:", err.response?.data || err.message);
      toast.error(err.response?.data?.message || "Failed to save review decision");
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="rounded-[28px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_44%,#fff7ed_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Catalog Review</p>
          <h1 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">Products</h1>
          <p className="text-slate-500">Review vendor submissions, keep the live catalog clean, and send helpful feedback fast.</p>
        </div>

        <button
          onClick={() => {
            setEditingProduct(null);
            setModalOpen(true);
          }}
          className="btn-primary inline-flex items-center gap-2"
        >
          <FiPlus /> Add Product
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Catalog Items", value: metrics.total, icon: FiPackage, tone: "text-slate-900", accent: "bg-slate-100 text-slate-700" },
          { label: "Needs Review", value: metrics.pendingReview, icon: FiShield, tone: "text-amber-700", accent: "bg-amber-100 text-amber-600" },
          { label: "Approved", value: metrics.approved, icon: FiCheckCircle, tone: "text-[#102A43]", accent: "bg-slate-100 text-[#102A43]" },
          { label: "Needs Changes", value: metrics.rejected, icon: FiXCircle, tone: "text-red-700", accent: "bg-red-100 text-red-600" },
          { label: "Low Stock", value: metrics.lowStock, icon: FiAlertTriangle, tone: "text-orange-700", accent: "bg-orange-100 text-orange-600" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="surface-panel p-5">
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

      {pendingVendorQueue.length ? (
        <section className="rounded-[28px] border border-amber-100 bg-[linear-gradient(135deg,#fffaf0_0%,#ffffff_100%)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-500">Review Queue</p>
              <h2 className="mt-1 text-lg font-black text-slate-900">Vendor submissions waiting for a decision</h2>
              <p className="text-sm text-slate-500">Approve products that are ready to sell, or send them back with clear notes.</p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              {pendingVendorQueue.length} pending vendor {pendingVendorQueue.length === 1 ? "item" : "items"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {pendingVendorQueue.slice(0, 6).map((product) => (
              <article key={product._id} className="surface-panel p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
                <div className="flex items-center gap-3">
                  <img
                    src={resolveImageUrl(product.images, PLACEHOLDER_IMAGE)}
                    alt={product.name}
                    onError={(event) => {
                      event.currentTarget.src = PLACEHOLDER_IMAGE;
                    }}
                    className="h-14 w-14 rounded-2xl object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.vendor?.storeName || product.vendor?.name || "Platform catalog"}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                  <span>Tsh {Number(product.price).toLocaleString()}</span>
                  <span>{product.stock} in stock</span>
                </div>
                <p className="mt-3 text-sm text-slate-500">{buildReviewSummary(product)}</p>
                <button
                  type="button"
                  onClick={() => openReviewModal(product)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 font-semibold text-amber-700 transition hover:bg-amber-100"
                >
                  <FiMessageSquare /> Review Product
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="surface-panel-wrap">
        {error ? (
          <div className="p-4">
            <PageState tone="error" title="Products unavailable" description={error} />
          </div>
        ) : null}
        <div className="grid gap-3 border-b border-slate-200/70 bg-white/80 p-4 md:grid-cols-4">
          <label className="block md:col-span-4">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Search products</span>
            <input
              className="input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by product, SKU, store, or review notes"
            />
            <p className="mt-2 text-xs text-slate-500">
              {paginationLabel} from {products.length} total products
            </p>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status</span>
            <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Stock</span>
            <select className="input" value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
              <option value="all">All stock levels</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Source</span>
            <select className="input" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="all">All sources</option>
              <option value="vendor">Vendor submissions</option>
              <option value="platform">Platform catalog</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Rows per page</span>
            <select className="input" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) || 10)}>
              <option value={10}>10 rows</option>
              <option value={20}>20 rows</option>
              <option value={50}>50 rows</option>
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-[linear-gradient(135deg,#eff6ff_0%,#fff7ed_100%)] text-left text-slate-600">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3">Store</th>
                <th className="p-3">Price</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Status</th>
                <th className="p-3">Review Notes</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                Array.isArray(products) &&
                paginatedProducts.map((product) => {
                  const lowStock = Number(product.stock || 0) <= LOW_STOCK_LIMIT;
                  const reviewDate = formatReviewDate(product.reviewedAt);

                  return (
                    <tr key={product._id} className="border-t border-slate-100 align-top transition hover:bg-orange-50/30">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={resolveImageUrl(product.images, PLACEHOLDER_IMAGE)}
                            alt={product.name}
                            onError={(event) => {
                              event.currentTarget.src = PLACEHOLDER_IMAGE;
                            }}
                            className="h-12 w-12 rounded-xl object-cover"
                          />
                          <div>
                            <p className="font-semibold text-slate-800">{product.name}</p>
                            <p className="text-xs font-mono text-slate-500">{product.sku || "SKU pending"}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        {product.vendor?.storeSlug ? (
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{product.vendor.storeName || product.vendor.name}</p>
                            <p className="text-xs text-slate-500">/{product.vendor.storeSlug}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Platform catalog</span>
                        )}
                      </td>

                      <td className="p-3 font-semibold text-slate-800">Tsh {Number(product.price).toLocaleString()}</td>

                      <td className="p-3 text-slate-700">
                        <div className="flex items-center gap-2">
                          {product.stock}
                          {lowStock ? <FiAlertTriangle className="text-red-500" /> : null}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getProductReviewStatusTone(product.status)}`}>
                          {product.status}
                        </span>
                        {reviewDate ? <p className="mt-2 text-xs text-slate-400">Reviewed {reviewDate}</p> : null}
                      </td>

                      <td className="p-3">
                        <p className="max-w-xs text-sm text-slate-600">{buildReviewSummary(product)}</p>
                        {product.reviewer?.name ? (
                          <p className="mt-2 text-xs text-slate-400">Last handled by {product.reviewer.name}</p>
                        ) : null}
                      </td>

                      <td className="p-3">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => openReviewModal(product)}
                            className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-600 transition hover:bg-amber-100"
                            title="Review product"
                          >
                            <FiMessageSquare />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(product);
                              setModalOpen(true);
                            }}
                            className="rounded-xl border border-[#102A43]/10 bg-slate-100 p-2 text-[#102A43] transition hover:bg-slate-200"
                            title="Edit product"
                          >
                            <FiEdit />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(product._id)}
                            className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
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
        </div>
        {filteredProducts.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-200/70 px-4 py-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <p>{paginationLabel}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
              >
                Previous
              </button>
              <span className="rounded-xl bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
        {!loading && filteredProducts.length === 0 ? (
          <div className="border-t border-slate-200/70 px-4 py-8 text-center text-sm text-slate-500">
            No products match the current filters.
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <ProductModal
          product={editingProduct}
          onClose={() => setModalOpen(false)}
          onSaved={fetchProducts}
          toast={toast}
        />
      ) : null}

      {reviewProduct ? (
        <ReviewModal
          product={reviewProduct}
          reviewNotes={reviewNotes}
          setReviewNotes={setReviewNotes}
          onClose={closeReviewModal}
          onApprove={() => submitReview("approve")}
          onReject={() => submitReview("reject")}
          submitting={reviewSubmitting}
        />
      ) : null}
    </div>
  );
}

function ReviewModal({ product, reviewNotes, setReviewNotes, onClose, onApprove, onReject, submitting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-[0_24px_50px_rgba(15,23,42,0.18)] md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-500">Product Review</p>
        <h2 className="mt-1 text-xl font-black text-slate-900">{product.name}</h2>
        <p className="mt-2 text-sm text-slate-500">
          {product.vendor?.storeName || product.vendor?.name || "Platform catalog"}
          {product.vendor?.storeSlug ? ` • /${product.vendor.storeSlug}` : ""}
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-[0.42fr_0.58fr]">
          <div className="overflow-hidden rounded-[24px] border border-slate-100 bg-slate-50 p-3">
            <img
              src={resolveImageUrl(product.images, PLACEHOLDER_IMAGE)}
              alt={product.name}
              onError={(event) => {
                event.currentTarget.src = PLACEHOLDER_IMAGE;
              }}
              className="h-48 w-full rounded-[18px] object-cover"
            />
            <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
              <span>Tsh {Number(product.price).toLocaleString()}</span>
              <span>{product.stock} in stock</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-amber-100 bg-amber-50/60 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">Decision Notes</p>
              <p className="mt-2">Approve to publish this item, or reject it with a clear note the vendor can act on.</p>
            </div>

            <textarea
              value={reviewNotes}
              onChange={(event) => setReviewNotes(event.target.value)}
              placeholder="Write a short review note or explain what needs to change"
              className="input min-h-[180px]"
            />

            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>
                Close
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
              >
                <FiXCircle /> {submitting ? "Saving..." : "Reject"}
              </button>
              <button
                type="button"
                onClick={onApprove}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
              >
                <FiCheckCircle /> {submitting ? "Saving..." : "Approve"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductModal({ product, onClose, onSaved, toast }) {
  const [form, setForm] = useState({
    name: product?.name || "",
    price: product?.price || "",
    stock: product?.stock || "",
    image: product?.image || product?.imageUrl || "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(
    resolveImageUrl(product?.imageUrl || product?.image, PLACEHOLDER_IMAGE)
  );

  const sku =
    product?.sku ||
    `PRD-${form.name.slice(0, 3).toUpperCase()}-${Date.now()
      .toString()
      .slice(-5)}`;

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleImageUpload = (file) => {
    if (!file) {
      return;
    }

    if (imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!product && !imageFile && !form.image) {
      toast.error("Product image is required");
      return;
    }

    try {
      const payload = new FormData();
      payload.append("name", form.name);
      payload.append("price", Number(form.price));
      payload.append("stock", Number(form.stock));
      payload.append("sku", sku);
      if (imageFile) {
        payload.append("image", imageFile);
      } else if (form.image) {
        payload.append("image", form.image);
      }

      if (product) {
        await axios.put(`/products/${product._id}`, payload);
        toast.success("Product updated");
      } else {
        await axios.post("/products", payload);
        toast.success("Product created");
      }

      await onSaved();
      onClose();
    } catch (err) {
      console.error("Save product error:", err.response?.data || err.message);
      toast.error(err.response?.data?.message || "Failed to save product");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-[2px]">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-[28px] border border-white/80 bg-white/95 p-4 shadow-[0_24px_50px_rgba(15,23,42,0.18)] md:p-6"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Product Editor</p>
        <h2 className="text-xl font-black text-slate-900">{product ? "Edit Product" : "New Product"}</h2>

        <input
          placeholder="Product name"
          className="input"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          required
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            type="number"
            placeholder="Price"
            className="input"
            value={form.price}
            onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
            required
          />

          <input
            type="number"
            placeholder="Stock"
            className="input"
            value={form.stock}
            onChange={(event) => setForm((prev) => ({ ...prev, stock: event.target.value }))}
            required
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          SKU: <span className="font-mono">{sku}</span>
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-orange-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_100%)] px-4 py-3 font-medium text-orange-700">
          <FiImage /> Upload Image
          <input
            type="file"
            hidden
            accept="image/*"
            onChange={(event) => handleImageUpload(event.target.files?.[0])}
          />
        </label>

        <div className="flex gap-2 flex-wrap">
          <img
            src={imagePreview}
            alt="Product preview"
            onError={(event) => {
              event.currentTarget.src = PLACEHOLDER_IMAGE;
            }}
            className="h-20 w-20 rounded-2xl border border-slate-200 object-cover"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>

          <button type="submit" className="btn-primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
