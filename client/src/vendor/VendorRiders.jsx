import { useEffect, useMemo, useState } from "react";
import { FiKey, FiLoader, FiPlus, FiToggleLeft, FiToggleRight, FiTruck } from "react-icons/fi";
import axios from "../utils/axios";
import { extractList, extractOne } from "../utils/apiShape";
import PageState from "../components/PageState";
import { useToast } from "../hooks/useToast";

export default function VendorRiders() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [riders, setRiders] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const loadRiders = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get("/vendor/riders");
      setRiders(extractList(data, ["items", "riders", "data"]));
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load rider team.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRiders();
  }, []);

  const summary = useMemo(
    () => ({
      total: riders.length,
      active: riders.filter((rider) => rider.isActive).length,
      available: riders.filter((rider) => rider.available).length,
    }),
    [riders]
  );

  const handleCreate = async (event) => {
    event.preventDefault();
    try {
      setCreating(true);
      const { data } = await axios.post("/vendor/riders", form);
      const nextRider = extractOne(data);
      setRiders((current) => [nextRider, ...current]);
      setForm({ name: "", email: "", phone: "", password: "" });
      toast.success(data?.message || "Rider created successfully");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to create rider");
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (rider, payload) => {
    try {
      setUpdatingId(rider.id);
      const { data } = await axios.patch(`/vendor/riders/${rider.id}/status`, payload);
      const updated = extractOne(data);
      setRiders((current) =>
        current.map((entry) => (entry.id === rider.id ? { ...entry, ...updated } : entry))
      );
      toast.success(data?.message || "Rider updated");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update rider");
    } finally {
      setUpdatingId(null);
    }
  };

  const resetPassword = async (rider) => {
    const password = window.prompt(`Set new password for ${rider.user?.email || rider.name}`);
    if (!password) return;

    try {
      setUpdatingId(rider.id);
      const { data } = await axios.patch(`/vendor/riders/${rider.id}/password`, { password });
      toast.success(data?.message || "Password reset successfully");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to reset rider password");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <PageState title="Loading rider team" description="Preparing your delivery crew..." />;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="rounded-[28px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_48%,#fff7ed_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Delivery Team</p>
        <h1 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">Vendor Riders</h1>
        <p className="mt-2 text-slate-500">Create riders for your store and keep their delivery status under your control.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="surface-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Riders</p>
          <p className="mt-3 text-2xl font-black text-slate-900">{summary.total}</p>
        </article>
        <article className="surface-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Active</p>
          <p className="mt-3 text-2xl font-black text-[#102A43]">{summary.active}</p>
        </article>
        <article className="surface-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Available</p>
          <p className="mt-3 text-2xl font-black text-orange-700">{summary.available}</p>
        </article>
      </section>

      {error ? <PageState tone="error" title="Riders unavailable" description={error} /> : null}

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleCreate} className="surface-panel-lg p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-600">
              <FiPlus />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Create Rider</h2>
              <p className="mt-1 text-sm text-slate-500">This rider will belong to your store and can receive your deliveries.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <input className="input" placeholder="Rider name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            <input type="email" className="input" placeholder="rider@example.com" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
            <input className="input" placeholder="Phone number" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required />
            <input type="password" className="input" placeholder="Temporary password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
          </div>

          <div className="mt-5 flex justify-end">
            <button type="submit" disabled={creating} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
              {creating ? <FiLoader className="animate-spin" /> : <FiPlus />}
              {creating ? "Saving rider..." : "Save Rider"}
            </button>
          </div>
        </form>

        <section className="surface-panel-wrap">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-[linear-gradient(135deg,#eff6ff_0%,#fff7ed_100%)] text-slate-600">
                <tr>
                  <th className="p-3 text-left">Rider</th>
                  <th className="p-3 text-left">Phone</th>
                  <th className="p-3 text-left">Active</th>
                  <th className="p-3 text-left">Available</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {riders.map((rider) => (
                  <tr key={rider.id} className="border-t border-slate-100 transition hover:bg-orange-50/30">
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{rider.name}</div>
                      <div className="text-xs text-slate-500">{rider.user?.email || "No login email"}</div>
                    </td>
                    <td className="p-3 text-slate-600">{rider.phone}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${rider.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {rider.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${rider.available ? "bg-slate-100 text-[#102A43]" : "bg-slate-200 text-slate-700"}`}>
                        {rider.available ? "Available" : "Busy"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={updatingId === rider.id}
                          onClick={() => resetPassword(rider)}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#102A43]/15 bg-[linear-gradient(135deg,#102A43_0%,#081B2E_100%)] px-3 py-1.5 text-white shadow-sm disabled:opacity-60"
                        >
                          <FiKey />
                          Reset Password
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === rider.id}
                          onClick={() => updateStatus(rider, { isActive: !rider.isActive })}
                          className="inline-flex items-center gap-1 rounded-xl border border-orange-300 bg-[linear-gradient(135deg,#F28C28_0%,#D97706_100%)] px-3 py-1.5 text-white shadow-sm disabled:opacity-60"
                        >
                          {rider.isActive ? <FiToggleRight /> : <FiToggleLeft />}
                          {rider.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === rider.id}
                          onClick={() => updateStatus(rider, { available: !rider.available })}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-600 bg-[linear-gradient(135deg,#334155_0%,#0f172a_100%)] px-3 py-1.5 text-white shadow-sm disabled:opacity-60"
                        >
                          {rider.available ? <FiToggleRight /> : <FiToggleLeft />}
                          {rider.available ? "Mark Busy" : "Mark Available"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!riders.length ? (
            <div className="border-t border-slate-200/70 px-4 py-8">
              <PageState tone="info" title="No riders yet" description="Create your first rider to start handling your store deliveries." />
            </div>
          ) : null}
        </section>
      </section>
    </div>
  );
}
