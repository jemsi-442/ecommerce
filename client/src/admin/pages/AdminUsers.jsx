import { useEffect, useMemo, useState } from "react";
import axios from "../../utils/axios";
import { FiUserCheck, FiUserX, FiTruck, FiLoader, FiKey, FiToggleLeft, FiToggleRight } from "react-icons/fi";
import { extractList, extractOne } from "../../utils/apiShape";
import PageState from "../../components/PageState";
import { useToast } from "../../hooks/useToast";

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

  const toggleRole = async (userId, currentRole) => {
    try {
      setUpdatingId(userId);
      const newRole = currentRole === "admin" ? "user" : "admin";
      const { data } = await axios.patch(`/users/${userId}/role`, { role: newRole });
      const updated = extractOne(data);
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, role: updated.role } : u))
      );
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
      <h2 className="text-xl md:text-2xl font-bold text-gray-800">Manage Users</h2>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 grid place-items-center shrink-0">
            <FiTruck />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">Create Rider Account</h3>
            <p className="text-sm text-slate-500 mt-1">
              Tengeneza rider mpya au geuza existing user kuwa rider moja kwa moja production.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateRider} className="mt-5 grid md:grid-cols-2 gap-3">
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
              className="inline-flex items-center gap-2 btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {creatingRider ? <FiLoader className="animate-spin" /> : <FiTruck />}
              {creatingRider ? "Saving rider..." : "Save Rider"}
            </button>
          </div>
        </form>
      </section>

      {riderUsers.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">Rider Accounts</h3>
            <p className="text-sm text-slate-500 mt-1">
              Angalia rider status, availability, na reset password yao bila terminal.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-100 text-slate-600">
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
                  <tr key={user._id} className="border-t">
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="p-3">{user.riderProfile.phone}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${user.riderProfile.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {user.riderProfile.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${user.riderProfile.available ? "bg-sky-100 text-sky-700" : "bg-slate-200 text-slate-700"}`}>
                        {user.riderProfile.available ? "Available" : "Busy"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={updatingId === user._id}
                          onClick={() => handleResetPassword(user)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-60"
                        >
                          <FiKey />
                          Reset Password
                        </button>
                        <button
                          disabled={updatingId === user._id}
                          onClick={() => handleToggleRiderStatus(user, "isActive")}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-white disabled:opacity-60"
                        >
                          {user.riderProfile.isActive ? <FiToggleRight /> : <FiToggleLeft />}
                          {user.riderProfile.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          disabled={updatingId === user._id}
                          onClick={() => handleToggleRiderStatus(user, "available")}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 text-white disabled:opacity-60"
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
        <div className="overflow-x-auto bg-white rounded-xl shadow">
          <table className="w-full min-w-[700px] border-collapse border border-gray-200">
            <thead className="bg-pink-100">
              <tr>
                <th className="p-2 border">Name</th>
                <th className="p-2 border">Email</th>
                <th className="p-2 border">Role</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-pink-50 transition">
                  <td className="p-2 border">{u.name}</td>
                  <td className="p-2 border">{u.email}</td>
                  <td className="p-2 border capitalize">{u.role}</td>
                  <td className="p-2 border">
                    {u.role === "rider" ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 rounded">
                        <FiTruck />
                        Rider account
                      </span>
                    ) : (
                      <button
                        disabled={updatingId === u._id}
                        onClick={() => toggleRole(u._id, u.role)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-60"
                      >
                        {u.role === "admin" ? <FiUserX /> : <FiUserCheck />}
                        {u.role === "admin" ? "Make User" : "Make Admin"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
