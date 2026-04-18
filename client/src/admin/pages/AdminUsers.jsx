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
  vendor: "bg-orange-50 text-orange-700",
  admin: "bg-slate-100 text-[#102A43]",
  rider: "bg-orange-100 text-orange-700",
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
    className: "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100",
  },
  {
    value: "admin",
    label: "Admin",
    icon: FiShield,
    className: "border-[#102A43]/15 bg-[linear-gradient(135deg,#102A43_0%,#081B2E_100%)] text-white hover:brightness-105",
  },
];

const formatRegisteredAt = (value) => {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
};

const renderContactCell = (user) => {
  const accountPhone = user.phone || null;
  const businessPhone = user.businessPhone || null;
  const storeLabel = user.storeName || user.storeSlug || null;

  if (user.role === "vendor") {
    return (
      <div className="space-y-1 text-slate-600">
        <p>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Account</span>
          <span className="ml-2">{accountPhone || "No phone"}</span>
        </p>
        <p>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Business</span>
          <span className="ml-2">{businessPhone || "No business phone"}</span>
        </p>
        {storeLabel ? (
          <p className="text-xs text-slate-500">Store: {storeLabel}</p>
        ) : null}
      </div>
    );
  }

  return <span className="text-slate-600">{accountPhone || "No phone"}</span>;
};

export default function AdminUsers() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [contactFilter, setContactFilter] = useState("all");
  const [recentFilter, setRecentFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
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

  const peopleUsers = useMemo(
    () => users.filter((user) => user.role !== "rider"),
    [users]
  );

  const summary = useMemo(() => {
    const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return {
      total: peopleUsers.length,
      vendors: peopleUsers.filter((user) => user.role === "vendor").length,
      missingPhones: peopleUsers.filter((user) => !String(user.phone || "").trim()).length,
      recent: peopleUsers.filter((user) => {
        const createdAt = new Date(user.createdAt || 0).getTime();
        return Number.isFinite(createdAt) && createdAt >= recentCutoff;
      }).length,
    };
  }, [peopleUsers]);

  const filteredUsers = useMemo(() => {
    const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return peopleUsers.filter((user) => {
      if (normalizedQuery) {
        const searchableText = [
          user.name,
          user.email,
          user.storeName,
          user.storeSlug,
          user.phone,
          user.businessPhone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(normalizedQuery)) {
          return false;
        }
      }

      if (roleFilter !== "all" && user.role !== roleFilter) {
        return false;
      }

      if (contactFilter === "missing_phone" && String(user.phone || "").trim()) {
        return false;
      }

      if (
        contactFilter === "missing_business_phone" &&
        (user.role !== "vendor" || String(user.businessPhone || "").trim())
      ) {
        return false;
      }

      if (recentFilter === "recent_7d") {
        const createdAt = new Date(user.createdAt || 0).getTime();
        if (!Number.isFinite(createdAt) || createdAt < recentCutoff) {
          return false;
        }
      }

      return true;
    });
  }, [contactFilter, peopleUsers, recentFilter, roleFilter, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [contactFilter, pageSize, recentFilter, roleFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredUsers, pageSize]);

  const paginationLabel = useMemo(() => {
    if (!filteredUsers.length) {
      return "Showing 0 results";
    }

    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, filteredUsers.length);
    return `Showing ${start}-${end} of ${filteredUsers.length}`;
  }, [currentPage, filteredUsers.length, pageSize]);

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
      <div className="rounded-[28px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_44%,#fff7ed_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Customers, Vendors & Team</p>
        <h2 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">People Management</h2>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="surface-panel-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">People</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{summary.total}</p>
        </div>
        <div className="surface-panel-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Vendors</p>
          <p className="mt-2 text-2xl font-black text-orange-600">{summary.vendors}</p>
        </div>
        <div className="surface-panel-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Missing phones</p>
          <p className="mt-2 text-2xl font-black text-red-600">{summary.missingPhones}</p>
        </div>
        <div className="surface-panel-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Joined in 7 days</p>
          <p className="mt-2 text-2xl font-black text-[#102A43]">{summary.recent}</p>
        </div>
      </section>

      <section className="surface-panel-lg p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-600">
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
        <section className="surface-panel-lg space-y-4 p-5 md:p-6">
          <div>
            <h3 className="text-lg font-black text-slate-900">Rider Accounts</h3>
            <p className="mt-1 text-sm text-slate-500">
              Monitor rider availability and keep delivery operations moving smoothly.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
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
                {riderUsers.map((user) => (
                  <tr key={user._id} className="border-t border-slate-100 transition hover:bg-orange-50/30">
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="p-3">{user.riderProfile.phone}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.riderProfile.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {user.riderProfile.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.riderProfile.available ? "bg-slate-100 text-[#102A43]" : "bg-slate-200 text-slate-700"}`}>
                        {user.riderProfile.available ? "Available" : "Busy"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={updatingId === user._id}
                          onClick={() => handleResetPassword(user)}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#102A43]/15 bg-[linear-gradient(135deg,#102A43_0%,#081B2E_100%)] px-3 py-1.5 text-white shadow-sm disabled:opacity-60"
                        >
                          <FiKey />
                          Reset Password
                        </button>
                        <button
                          disabled={updatingId === user._id}
                          onClick={() => handleToggleRiderStatus(user, "isActive")}
                          className="inline-flex items-center gap-1 rounded-xl border border-orange-300 bg-[linear-gradient(135deg,#F28C28_0%,#D97706_100%)] px-3 py-1.5 text-white shadow-sm disabled:opacity-60"
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
        <div className="surface-panel-wrap">
          <div className="grid gap-3 border-b border-slate-200/70 bg-white/80 p-4 md:grid-cols-4">
            <label className="block md:col-span-4">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Search people</span>
              <input
                className="input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by name, email, store, or phone"
              />
              <p className="mt-2 text-xs text-slate-500">
                {paginationLabel} from {peopleUsers.length} total people
              </p>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Role</span>
              <select className="input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="all">All roles</option>
                <option value="customer">Customers</option>
                <option value="vendor">Vendors</option>
                <option value="admin">Admins</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Contact health</span>
              <select className="input" value={contactFilter} onChange={(event) => setContactFilter(event.target.value)}>
                <option value="all">All contacts</option>
                <option value="missing_phone">Missing account phone</option>
                <option value="missing_business_phone">Vendors missing business phone</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Registration</span>
              <select className="input" value={recentFilter} onChange={(event) => setRecentFilter(event.target.value)}>
                <option value="all">All time</option>
                <option value="recent_7d">Joined in last 7 days</option>
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
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-[linear-gradient(135deg,#eff6ff_0%,#fff7ed_100%)] text-slate-600">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Phone</th>
                  <th className="p-3 text-left">Registered</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((u) => (
                  <tr key={u._id} className="border-t border-slate-100 transition hover:bg-orange-50/30">
                    <td className="p-3 font-semibold text-slate-800">{u.name}</td>
                    <td className="p-3 text-slate-600">{u.email}</td>
                    <td className="p-3">{renderContactCell(u)}</td>
                    <td className="p-3 text-slate-600">{formatRegisteredAt(u.createdAt)}</td>
                    <td className="p-3 capitalize">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ROLE_BADGES[u.role] || ROLE_BADGES.customer}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3">
                      {u.role === "rider" ? (
                        <span className="inline-flex items-center gap-1 rounded-xl border border-orange-200 bg-orange-100 px-3 py-1.5 text-orange-700">
                          <FiTruck />
                          Rider account
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {MANAGED_ROLE_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            const isActive = u.role === option.value;
                            const isProtectedAdmin = u.role === "admin" && option.value !== "admin";

                            return (
                              <button
                                key={`${u._id}-${option.value}`}
                                disabled={updatingId === u._id || isActive || isProtectedAdmin}
                                onClick={() => setUserRole(u._id, option.value)}
                                className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${option.className}`}
                              >
                                <Icon />
                                {isProtectedAdmin
                                  ? "Protected Admin"
                                  : isActive
                                    ? `${option.label} Active`
                                    : `Make ${option.label}`}
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
          {filteredUsers.length > 0 ? (
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
          {filteredUsers.length === 0 ? (
            <div className="border-t border-slate-200/70 px-4 py-8 text-center text-sm text-slate-500">
              No people match the current filters.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
