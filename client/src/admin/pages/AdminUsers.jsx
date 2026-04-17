import { useEffect, useMemo, useState } from "react";
import axios from "../../utils/axios";
import {
  FiBriefcase,
  FiKey,
  FiLoader,
  FiShield,
  FiToggleLeft,
  FiToggleRight,
  FiTruck,
  FiUser,
} from "react-icons/fi";
import { extractList, extractOne } from "../../utils/apiShape";
import PageState from "../../components/PageState";
import { useToast } from "../../hooks/useToast";

const ROLE_BADGES = {
  customer: "bg-slate-100 text-slate-700",
  vendor: "bg-sky-100 text-sky-700",
  admin: "bg-violet-100 text-violet-700",
  rider: "bg-amber-100 text-amber-700",
};

const MANAGED_ROLE_OPTIONS = [
  {
    value: "customer",
    label: "Customer",
    icon: FiUser,
    className: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  },
  {
    value: "vendor",
    label: "Vendor",
    icon: FiBriefcase,
    className: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
  },
  {
    value: "admin",
    label: "Admin",
    icon: FiShield,
    className: "border-violet-300 bg-[linear-gradient(135deg,#8b5cf6_0%,#ec4899_100%)] text-white hover:brightness-105",
  },
];

export default function AdminUsers() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [creatingRider, setCreatingRider] = useState(false);
  const [riderForm, setRiderForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get("/users");
      setUsers(extractList(data, ["users", "items"]));
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const setUserRole = async (userId, role) => {
    try {
      setUpdatingId(userId);
      const { data } = await axios.patch(`/users/${userId}/role`, { role });
      const updated = extractOne(data);
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, role: updated.role } : u))
      );
      toast.success(`Role updated to ${updated.role}`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const riderUsers = useMemo(
    () => users.filter((user) => user.role === "rider" && user.riderProfile),
    [users]
  );

  const handleCreateRider = async (e) => {
    e.preventDefault();

    try {
      setCreatingRider(true);
      await axios.post("/users/riders", riderForm);
      toast.success("Rider account saved successfully");
      setRiderForm({ name: "", email: "", phone: "", password: "" });
      await fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to create rider");
    } finally {
      setCreatingRider(false);
    }
  };

  const handleResetPassword = async (user) => {
    const password = window.prompt(`Set new password for ${user.email}`);
    if (!password) return;

    try {
      setUpdatingId(user._id);
      await axios.patch(`/users/${user._id}/password`, { password });
      toast.success("Password reset successfully");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to reset password");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleRiderStatus = async (user, field) => {
    const riderProfile = user.riderProfile;
    if (!riderProfile) return;

    try {
      setUpdatingId(user._id);
      const payload =
        field === "isActive"
          ? { isActive: !riderProfile.isActive }
          : { available: !riderProfile.available };

      const { data } = await axios.patch(`/users/${user._id}/rider-status`, payload);
      const updated = extractOne(data);

      setUsers((prev) =>
        prev.map((entry) =>
          entry._id === user._id
            ? { ...entry, riderProfile: { ...entry.riderProfile, ...updated } }
            : entry
        )
      );
      toast.success("Rider status updated");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update rider status");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
      <div className="rounded-[28px] border border-violet-100 bg-[linear-gradient(135deg,#f5f3ff_0%,#ffffff_44%,#fff7ed_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-400">Customers, Vendors & Team</p>
        <h2 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">People Management</h2>
      </div>

      <section className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.06)] md:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-600">
            <FiTruck />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">Create Rider Account</h3>
            <p className="mt-1 text-sm text-slate-500">
              Add a new rider account to support faster delivery operations.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateRider} className="mt-5 grid gap-3 md:grid-cols-2">
          <input
            className="input"
            placeholder="Rider name"
            value={riderForm.name}
            onChange={(e) => setRiderForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <input
            type="email"
            className="input"
            placeholder="rider@example.com"
            value={riderForm.email}
            onChange={(e) => setRiderForm((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
          <input
            className="input"
            placeholder="Phone number"
            value={riderForm.phone}
            onChange={(e) => setRiderForm((prev) => ({ ...prev, phone: e.target.value }))}
            required
          />
          <input
            type="password"
            className="input"
            placeholder="Temporary password"
            value={riderForm.password}
            onChange={(e) => setRiderForm((prev) => ({ ...prev, password: e.target.value }))}
            required
          />

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={creatingRider}
              className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingRider ? <FiLoader className="animate-spin" /> : <FiTruck />}
              {creatingRider ? "Saving rider..." : "Save Rider"}
            </button>
          </div>
        </form>
      </section>

      {riderUsers.length > 0 && (
        <section className="space-y-4 rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.06)] md:p-6">
          <div>
            <h3 className="text-lg font-black text-slate-900">Rider Accounts</h3>
            <p className="mt-1 text-sm text-slate-500">
              Monitor rider availability and keep delivery operations moving smoothly.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-[linear-gradient(135deg,#f5f3ff_0%,#f8fafc_100%)] text-slate-600">
                <tr>
                  <th className="p-3 text-left">Rider</th>
                  <th className="p-3 text-left">Phone</th>
                  <th className="p-3 text-left">Active</th>
                  <th className="p-3 text-left">Available</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {riderUsers.map((user) => (
                  <tr key={user._id} className="border-t border-slate-100 transition hover:bg-violet-50/30">
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="p-3">{user.riderProfile.phone}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.riderProfile.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {user.riderProfile.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.riderProfile.available ? "bg-sky-100 text-sky-700" : "bg-slate-200 text-slate-700"}`}>
                        {user.riderProfile.available ? "Available" : "Busy"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={updatingId === user._id}
                          onClick={() => handleResetPassword(user)}
                          className="inline-flex items-center gap-1 rounded-xl border border-indigo-300 bg-[linear-gradient(135deg,#6366f1_0%,#8b5cf6_100%)] px-3 py-1.5 text-white shadow-sm disabled:opacity-60"
                        >
                          <FiKey />
                          Reset Password
                        </button>
                        <button
                          disabled={updatingId === user._id}
                          onClick={() => handleToggleRiderStatus(user, "isActive")}
                          className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-[linear-gradient(135deg,#f59e0b_0%,#fb7185_100%)] px-3 py-1.5 text-white shadow-sm disabled:opacity-60"
                        >
                          {user.riderProfile.isActive ? <FiToggleRight /> : <FiToggleLeft />}
                          {user.riderProfile.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          disabled={updatingId === user._id}
                          onClick={() => handleToggleRiderStatus(user, "available")}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-600 bg-[linear-gradient(135deg,#334155_0%,#0f172a_100%)] px-3 py-1.5 text-white shadow-sm disabled:opacity-60"
                        >
                          {user.riderProfile.available ? <FiToggleRight /> : <FiToggleLeft />}
                          {user.riderProfile.available ? "Mark Busy" : "Mark Available"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {loading ? (
        <PageState title="Loading users..." />
      ) : error ? (
        <PageState tone="error" title="Users unavailable" description={error} />
      ) : users.length === 0 ? (
        <PageState title="No users found" />
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/92 shadow-[0_20px_40px_rgba(15,23,42,0.07)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-[linear-gradient(135deg,#fff1f2_0%,#f5f3ff_100%)] text-slate-600">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className="border-t border-slate-100 transition hover:bg-rose-50/30">
                    <td className="p-3 font-semibold text-slate-800">{u.name}</td>
                    <td className="p-3 text-slate-600">{u.email}</td>
                    <td className="p-3 capitalize">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ROLE_BADGES[u.role] || ROLE_BADGES.customer}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3">
                      {u.role === "rider" ? (
                        <span className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-100 px-3 py-1.5 text-amber-700">
                          <FiTruck />
                          Rider account
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {MANAGED_ROLE_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            const isActive = u.role === option.value;

                            return (
                              <button
                                key={`${u._id}-${option.value}`}
                                disabled={updatingId === u._id || isActive}
                                onClick={() => setUserRole(u._id, option.value)}
                                className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${option.className}`}
                              >
                                <Icon />
                                {isActive ? `${option.label} Active` : `Make ${option.label}`}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
