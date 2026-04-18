import { useEffect, useMemo, useState } from "react";
import { FiSave, FiHome, FiUser, FiPhone, FiMail, FiClock } from "react-icons/fi";
import PageState from "../components/PageState";
import axios from "../utils/axios";
import { extractOne } from "../utils/apiShape";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../hooks/useAuth";

const defaultForm = {
  storeName: "",
  storeSlug: "",
  businessPhone: "",
  businessDescription: "",
};

const defaultAccountForm = {
  name: "",
  email: "",
  phone: "",
  createdAt: "",
};

export default function VendorProfile() {
  const toast = useToast();
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [accountForm, setAccountForm] = useState(defaultAccountForm);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const [{ data: profileData }, { data: accountData }] = await Promise.all([
          axios.get("/vendor/profile"),
          axios.get("/users/me"),
        ]);
        const profile = extractOne(profileData) || {};
        const account = extractOne(accountData) || {};
        setForm({
          storeName: profile.storeName || "",
          storeSlug: profile.storeSlug || "",
          businessPhone: profile.businessPhone || "",
          businessDescription: profile.businessDescription || "",
        });
        setAccountForm({
          name: account.name || "",
          email: account.email || "",
          phone: account.phone || "",
          createdAt: account.createdAt || "",
        });
        setError("");
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load store profile.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const joinedAtLabel = useMemo(() => {
    if (!accountForm.createdAt) {
      return "Recently";
    }

    const date = new Date(accountForm.createdAt);
    if (Number.isNaN(date.getTime())) {
      return "Recently";
    }

    return date.toLocaleString();
  }, [accountForm.createdAt]);

  const handleAccountSubmit = async (event) => {
    event.preventDefault();
    setSavingAccount(true);

    try {
      const { data } = await axios.patch("/users/me", {
        name: accountForm.name,
        email: accountForm.email,
        phone: accountForm.phone,
      });
      const nextUser = extractOne(data) || {};
      setAccountForm((current) => ({
        ...current,
        name: nextUser.name || "",
        email: nextUser.email || "",
        phone: nextUser.phone || "",
        createdAt: nextUser.createdAt || current.createdAt || "",
      }));
      updateUser?.(nextUser);
      toast.success(data?.message || "Account details updated");
      setError("");
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.message || "Failed to save account details.";
      setError(message);
      toast.error(message);
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const { data } = await axios.patch("/vendor/profile", form);
      const profile = extractOne(data) || {};
      setForm({
        storeName: profile.storeName || "",
        storeSlug: profile.storeSlug || "",
        businessPhone: profile.businessPhone || "",
        businessDescription: profile.businessDescription || "",
      });
      toast.success("Store profile saved");
      setError("");
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.message || "Failed to save store profile.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageState title="Loading store profile" description="Preparing your vendor details..." />;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="rounded-[28px] border border-amber-100 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_48%,#fffbeb_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-500">Store Profile</p>
        <h1 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">Shape your vendor identity</h1>
        <p className="mt-2 text-slate-500">This information helps your store feel real, memorable, and ready for growth.</p>
      </section>

      {error ? <PageState tone="error" title="Profile update issue" description={error} /> : null}

      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <form onSubmit={handleAccountSubmit} className="surface-panel-lg p-5 md:p-6">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-slate-100 p-3 text-[#102A43]">
              <FiUser size={18} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Account details</p>
              <h2 className="text-lg font-black text-slate-900">Keep your login contact up to date</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Full name</span>
              <input
                className="input"
                value={accountForm.name}
                onChange={(event) => setAccountForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Vendor owner name"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Email address</span>
              <input
                type="email"
                className="input"
                value={accountForm.email}
                onChange={(event) => setAccountForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="vendor@example.com"
                required
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Account phone</span>
              <input
                type="tel"
                className="input"
                value={accountForm.phone}
                onChange={(event) => setAccountForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="+255 700 000 000"
                required
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button type="submit" disabled={savingAccount} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
              <FiSave /> {savingAccount ? "Saving..." : "Save Account Details"}
            </button>
          </div>
        </form>

        <aside className="surface-panel-lg p-5 md:p-6">
          <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(160deg,#f8fafc_0%,#ffffff_100%)] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Account summary</p>
            <div className="mt-5 space-y-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-slate-100 p-2 text-[#102A43]"><FiMail size={16} /></span>
                <div>
                  <p className="font-semibold text-slate-900">Login email</p>
                  <p>{accountForm.email || "Add your email"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-orange-50 p-2 text-orange-600"><FiPhone size={16} /></span>
                <div>
                  <p className="font-semibold text-slate-900">Account phone</p>
                  <p>{accountForm.phone || "Add your account phone"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-slate-100 p-2 text-slate-600"><FiClock size={16} /></span>
                <div>
                  <p className="font-semibold text-slate-900">Joined marketplace</p>
                  <p>{joinedAtLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <form onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="surface-panel-lg p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Store name</label>
              <input
                className="input"
                value={form.storeName}
                onChange={(event) => setForm((prev) => ({ ...prev, storeName: event.target.value }))}
                placeholder="Example: Mambo Home Collection"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Store slug</label>
              <input
                className="input"
                value={form.storeSlug}
                onChange={(event) => setForm((prev) => ({ ...prev, storeSlug: event.target.value }))}
                placeholder="mambo-home-collection"
              />
              <p className="mt-2 text-xs text-slate-500">Use letters, numbers, and hyphens only. We will keep it unique for you.</p>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Business phone</label>
              <input
                className="input"
                value={form.businessPhone}
                onChange={(event) => setForm((prev) => ({ ...prev, businessPhone: event.target.value }))}
                placeholder="0683 186 987"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Store description</label>
              <textarea
                className="input min-h-[180px]"
                value={form.businessDescription}
                onChange={(event) => setForm((prev) => ({ ...prev, businessDescription: event.target.value }))}
                placeholder="Tell customers what makes your store worth buying from."
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
              <FiSave /> {saving ? "Saving..." : "Save Store Profile"}
            </button>
          </div>
        </section>

        <aside className="surface-panel-lg p-5 md:p-6">
          <div className="rounded-[26px] border border-amber-200/70 bg-[linear-gradient(160deg,#fff7ed_0%,#ffffff_100%)] p-5">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-amber-100 p-3 text-amber-600">
                <FiHome size={18} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-500">Preview</p>
                <h2 className="text-lg font-black text-slate-900">{form.storeName || "Your Store Name"}</h2>
              </div>
            </div>

            <div className="mt-5 space-y-4 text-sm text-slate-600">
              <div>
                <p className="font-semibold text-slate-900">Store URL</p>
                <p>/{form.storeSlug || "your-store-slug"}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Business phone</p>
                <p>{form.businessPhone || "Add a business contact number"}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Store story</p>
                <p>
                  {form.businessDescription ||
                    "Add a short, clear description that helps customers trust your brand."}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
