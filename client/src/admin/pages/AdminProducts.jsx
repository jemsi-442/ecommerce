import { useEffect, useState } from "react";
import axios from "../../utils/axios"; // API instance
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiAlertTriangle,
  FiImage,
  FiCheckCircle,
} from "react-icons/fi";
import { extractList } from "../../utils/apiShape";
import { PLACEHOLDER_IMAGE, resolveImageUrl } from "../../utils/image";
import PageState from "../../components/PageState";
import { useToast } from "../../hooks/useToast";

const LOW_STOCK_LIMIT = 5;

export default function AdminProducts() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [error, setError] = useState("");
  const [approvingId, setApprovingId] = useState(null);

  /* ================= FETCH PRODUCTS ================= */
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

  /* ================= DELETE ================= */
  const handleDelete = async (id) => {
    if (!confirm("Delete this product?")) return;

    try {
      await axios.delete(`/products/${id}`);
      fetchProducts();
    } catch (err) {
      console.error("Delete error:", err.response?.data || err.message);
    }
  };

  /* ================= APPROVE ================= */
  const handleApprove = async (id) => {
    try {
      setApprovingId(id);
      await axios.put(`/products/${id}/approve`);
      toast.success("Product approved");
      fetchProducts();
    } catch (err) {
      console.error("Approve error:", err.response?.data || err.message);
      toast.error(err.response?.data?.message || "Failed to approve product");
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Products</h1>
          <p className="text-gray-500">Inventory Management</p>
        </div>

        <button
          onClick={() => {
            setEditingProduct(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg"
        >
          <FiPlus /> Add Product
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        {error ? (
          <div className="p-4">
            <PageState tone="error" title="Products unavailable" description={error} />
          </div>
        ) : null}
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">SKU</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {!loading &&
              Array.isArray(products) &&
              products.map((p) => {
                const lowStock = p.stock <= LOW_STOCK_LIMIT;

                return (
                  <tr key={p._id} className="border-t">
                    <td className="p-3 flex items-center gap-3">
                      <img
                        src={resolveImageUrl(p.images, PLACEHOLDER_IMAGE)}
                        alt={p.name}
                        onError={(e) => {
                          e.currentTarget.src = PLACEHOLDER_IMAGE;
                        }}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <span className="font-medium">{p.name}</span>
                    </td>

                    <td className="p-3 font-mono text-xs">{p.sku}</td>

                    <td className="p-3 font-semibold">
                      Tsh {Number(p.price).toLocaleString()}
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {p.stock}
                        {lowStock && (
                          <FiAlertTriangle className="text-red-500" />
                        )}
                      </div>
                    </td>

                    <td className="p-3">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          p.status === "approved"
                            ? "bg-emerald-100 text-emerald-700"
                            : p.status === "rejected"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {p.status || "pending"}
                      </span>
                    </td>

                    <td className="p-3 flex gap-3">
                      {p.status !== "approved" && (
                        <button
                          onClick={() => handleApprove(p._id)}
                          disabled={approvingId === p._id}
                          className="text-emerald-600 disabled:opacity-50"
                          title="Approve product"
                        >
                          <FiCheckCircle />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setEditingProduct(p);
                          setModalOpen(true);
                        }}
                        className="text-blue-600"
                      >
                        <FiEdit />
                      </button>

                      <button
                        onClick={() => handleDelete(p._id)}
                        className="text-red-600"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {loading && (
          <div className="p-6 text-center text-gray-500">
            Loading products...
          </div>
        )}
      </div>

      {modalOpen && (
        <ProductModal
          product={editingProduct}
          onClose={() => setModalOpen(false)}
          onSaved={fetchProducts}
        />
      )}
    </div>
  );
}

/* ================= MODAL ================= */

function ProductModal({ product, onClose, onSaved }) {
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
    `PCH-${form.name.slice(0, 3).toUpperCase()}-${Date.now()
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

  /* ===== SAVE PRODUCT ===== */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!product && !imageFile && !form.image) {
      console.error("Product image is required");
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
      } else {
        await axios.post("/products", payload);
      }

      await onSaved();
      onClose();
    } catch (err) {
      console.error("Save product error:", err.response?.data || err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3">
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full max-w-lg rounded-xl p-4 md:p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-xl font-bold">
          {product ? "Edit Product" : "New Product"}
        </h2>

        <input
          placeholder="Product name"
          className="input"
          value={form.name}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, name: e.target.value }))
          }
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="number"
            placeholder="Price"
            className="input"
            value={form.price}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, price: e.target.value }))
            }
            required
          />

          <input
            type="number"
            placeholder="Stock"
            className="input"
            value={form.stock}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, stock: e.target.value }))
            }
            required
          />
        </div>

        <div className="text-xs text-gray-500">
          SKU: <span className="font-mono">{sku}</span>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-pink-600">
          <FiImage /> Upload Image
          <input
            type="file"
            hidden
            accept="image/*"
            onChange={(e) => handleImageUpload(e.target.files[0])}
          />
        </label>

        <div className="flex gap-2 flex-wrap">
          <img
            src={imagePreview}
            alt="Product preview"
            onError={(e) => {
              e.currentTarget.src = PLACEHOLDER_IMAGE;
            }}
            className="w-20 h-20 object-cover rounded"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="px-4 py-2 bg-pink-600 text-white rounded-lg"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
