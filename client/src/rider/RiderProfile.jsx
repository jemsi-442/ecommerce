import { useEffect, useMemo, useState } from "react";
import { FiClock, FiSave, FiToggleLeft, FiToggleRight, FiTruck, FiUser } from "react-icons/fi";
import axios from "../utils/axios";
import { extractOne } from "../utils/apiShape";
import PageState from "../components/PageState";
import { useAuth } from "../hooks/useAuth";
import useToast from "../hooks/useToast";

const formatDateTime = (value) => {
  if (!value) return "Not available";
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

export default function RiderProfile() {
  const toast = useToast();
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const loadProfile = async () => {
    try {
      setLoading(true);
      const [userResponse, riderResponse] = await Promise.all([
        axios.get("/users/me"),
        axios.get("/rider/profile"),
      ]);

      const user = extractOne(userResponse.data);
      const rider = extractOne(riderResponse.data);
      setProfile(rider);
      setForm({
        name: user?.name || rider?.user?.name || "",
        email: user?.email || rider?.user?.email || "",
        phone: user?.phone || rider?.user?.phone || rider?.phone || "",
      });
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load rider profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const shiftStatus = useMemo(() => {
    if (!profile) return null;
    if (!profile.isActive) return "Inactive";
    return profile.available ? "Available for new deliveries" : "Paused from new deliveries";
  }, [profile]);

  const handleAccountSubmit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      const { data } = await axios.patch("/users/me", form);
      const nextUser = extractOne(data);
      updateUser?.(nextUser);
      setForm({
        name: nextUser?.name || "",
        email: nextUser?.email || "",
        phone: nextUser?.phone || "",
      });
      setProfile((current) =>
        current
          ? {
              ...current,
              name: nextUser?.name || current.name,
              phone: nextUser?.phone || current.phone,
              user: {
                ...(current.user || {}),
                ...nextUser,
              },
            }
          : current
      );
      toast.success(data?.message || "Profile updated");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async () => {
    if (!profile) return;
    try {
      setToggling(true);
      const { data } = await axios.patch("/rider/status", { available: !profile.available });
      const nextProfile = extractOne(data);
      setProfile(nextProfile);
      toast.success(data?.message || "Availability updated");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update availability");
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return <PageState title="Loading rider profile" description="Preparing your shift settings and account details..." />;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="rounded-[28px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_48%,#fff7ed_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Rider Profile</p>
        <h1 className="mt-1 text-2xl font-black text-slate-900 md:text-3xl">Account and Shift Control</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
          Keep your account details current, switch your delivery availability on or off, and review the vendor/store team you are delivering for.
        </p>
      </section>

      {error ? <PageState tone="error" title="Profile unavailable" description={error} /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Shift status" value={shiftStatus || "Not available"} tone={profile?.available ? "navy" : "orange"} />
        <MetricCard label="Current orders" value={profile?.currentOrders ?? 0} tone="slate" />
        <MetricCard label="Last assigned" value={formatDateTime(profile?.lastAssignedAt)} tone="orange" />
        <MetricCard label="Joined delivery team" value={formatDateTime(profile?.createdAt)} tone="navy" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <form onSubmit={handleAccountSubmit} className="surface-panel-lg p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#102A43]/10 text-[#102A43]">
              <FiUser />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Account details</h2>
              <p className="mt-1 text-sm text-slate-500">These details are used when customers and operations teams need to identify you.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <input className="input" placeholder="Full name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            <input type="email" className="input" placeholder="Email address" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
            <input className="input" placeholder="Phone number" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required />
          </div>

          <div className="mt-5 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
              <FiSave />
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>

        <div className="space-y-5">
          <section className="surface-panel-lg p-5 md:p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-700">
                <FiTruck />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Availability</h2>
                <p className="mt-1 text-sm text-slate-500">Pause new assignments when you need a break, then switch back on when you are ready to take the next order.</p>
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Current mode</p>
              <p className="mt-2 text-lg font-black text-slate-900">{shiftStatus}</p>
              <p className="mt-1 text-sm text-slate-500">
                {profile?.available
                  ? "New paid orders can be assigned to you."
                  : "You will keep working on current orders, but no new delivery should be assigned."}
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={toggleAvailability}
                disabled={toggling || !profile?.isActive}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60 ${
                  profile?.available
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[linear-gradient(135deg,#102A43_0%,#081B2E_100%)] hover:brightness-110"
                }`}
              >
                {profile?.available ? <FiToggleLeft /> : <FiToggleRight />}
                {toggling ? "Saving..." : profile?.available ? "Pause new deliveries" : "Become available"}
              </button>
            </div>
          </section>

          <section className="surface-panel-lg p-5 md:p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                <FiClock />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Delivery team context</h2>
                <p className="mt-1 text-sm text-slate-500">Keep track of the store team and timing around your rider account.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <InfoRow label="Store" value={profile?.vendor?.storeName || profile?.vendor?.name || "Global rider pool"} />
              <InfoRow label="Store phone" value={profile?.vendor?.businessPhone || "Not available"} />
              <InfoRow label="Account email" value={profile?.user?.email || form.email || "Not available"} />
              <InfoRow label="Last assignment" value={formatDateTime(profile?.lastAssignedAt)} />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, tone = "slate" }) {
  const toneMap = {
    navy: "bg-[#102A43]/5 text-[#102A43]",
    orange: "bg-orange-50 text-orange-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <article className="surface-panel p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <div className={`mt-4 rounded-2xl px-3 py-3 text-sm font-black ${toneMap[tone] || toneMap.slate}`}>
        {value}
      </div>
    </article>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="text-right font-semibold text-slate-900">{value}</p>
    </div>
  );
}
