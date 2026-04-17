import { useEffect, useState } from "react";
import { FiCheckCircle, FiClock, FiCreditCard, FiDownload, FiPauseCircle } from "react-icons/fi";
import axios from "../../utils/axios";
import { extractList, extractOne } from "../../utils/apiShape";
import PageState from "../../components/PageState";
import PayoutTrendCharts from "../../components/PayoutTrendCharts";
import { useToast } from "../../hooks/useToast";
import { TableSkeleton } from "../../components/Skeleton";
import { buildPayoutStatusChartData, buildPayoutTrendData, buildSettlementPerformance, buildTopVendorPayouts } from "../../utils/payoutAnalytics";

const formatCurrency = (value) => `Tsh ${Number(value || 0).toLocaleString()}`;

const statusTone = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  on_hold: "bg-rose-100 text-rose-700",
};

export default function AdminPayouts() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [records, setRecords] = useState([]);
  const [readyQueue, setReadyQueue] = useState([]);
  const [summary, setSummary] = useState({
    totalRecords: 0,
    pendingRecords: 0,
    paidRecords: 0,
    readyQueueAmount: 0,
    totalPaid: 0,
  });
  const [submittingId, setSubmittingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const params = {
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(fromDate ? { from: fromDate } : {}),
        ...(toDate ? { to: toDate } : {}),
      };
      const { data } = await axios.get("/admin/vendor-payouts", { params });
      setRecords(extractList(data, ["payouts", "items"]));
      setReadyQueue(extractOne(data)?.readyQueue || []);
      setSummary(
        extractOne(data)?.summary || {
          totalRecords: 0,
          pendingRecords: 0,
          paidRecords: 0,
          readyQueueAmount: 0,
          totalPaid: 0,
        }
      );
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load vendor payouts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [statusFilter, fromDate, toDate]);

  const downloadReport = async () => {
    try {
      setExporting(true);
      const response = await axios.get("/admin/vendor-payouts/export.csv", {
        params: {
          ...(statusFilter !== "all" ? { status: statusFilter } : {}),
          ...(fromDate ? { from: fromDate } : {}),
          ...(toDate ? { to: toDate } : {}),
        },
        responseType: "blob",
      });
      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "text/csv;charset=utf-8",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "vendor-settlements-" + new Date().toISOString().slice(0, 10) + ".csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Settlement report downloaded");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to download settlement report");
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
  };

  const createRecord = async (entry) => {
    const notes = window.prompt("Optional settlement note", "") || "";
    try {
      setSubmittingId(entry._id);
      await axios.post("/admin/vendor-payouts", {
        orderId: entry.orderId,
        vendorId: entry.vendorId,
        notes,
      });
      toast.success("Settlement record created");
      fetchPayouts();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to create settlement record");
      setSubmittingId(null);
    }
  };

  const updateStatus = async (record, status) => {
    const notes = window.prompt("Update notes", record.notes || "") || record.notes || "";
    try {
      setSubmittingId(record._id);
      await axios.put(`/admin/vendor-payouts/${record._id}`, { status, notes });
      toast.success(status === "paid" ? "Payout marked as paid" : "Payout updated");
      fetchPayouts();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update payout");
      setSubmittingId(null);
    }
  };

  if (loading) return <TableSkeleton rows={5} />;

  const trendData = buildPayoutTrendData(records);
  const statusData = buildPayoutStatusChartData(records, readyQueue);
  const topVendors = buildTopVendorPayouts(records);
  const performance = buildSettlementPerformance(records);

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_42%,#eef2ff_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-500">Vendor Settlements</p>
        <h1 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">Payout Management</h1>
        <p className="mt-1 text-sm text-slate-500">Queue vendor settlements, mark payouts as paid, and track anything on hold.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={downloadReport}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
          >
            <FiDownload /> {exporting ? "Preparing report..." : "Download CSV report"}
          </button>
        </div>
      </section>

      {error ? <PageState tone="error" title="Payouts unavailable" description={error} /> : null}

      <section className="rounded-[26px] border border-white/80 bg-white/92 p-4 shadow-[0_18px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Filter Reports</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Focus on the settlements you need</h2>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Reset filters
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <label className="space-y-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-300"
            >
              <option value="all">All payout statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="on_hold">On hold</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-300"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-300"
            />
          </label>
          <div className="flex items-end">
            <div className="w-full rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Reports and CSV export use these filters automatically.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Ready to Settle", value: formatCurrency(summary.readyQueueAmount), icon: FiClock, tone: "text-amber-700", accent: "bg-amber-100 text-amber-600" },
          { label: "Pending Records", value: summary.pendingRecords || 0, icon: FiPauseCircle, tone: "text-sky-700", accent: "bg-sky-100 text-sky-600" },
          { label: "Paid Out", value: formatCurrency(summary.totalPaid), icon: FiCheckCircle, tone: "text-emerald-700", accent: "bg-emerald-100 text-emerald-600" },
          { label: "Settlement Records", value: summary.totalRecords || 0, icon: FiCreditCard, tone: "text-violet-700", accent: "bg-violet-100 text-violet-600" },
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

      <PayoutTrendCharts trendData={trendData} statusData={statusData} tone="emerald" />

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Top Vendors</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">Who is driving settlement value</h2>
          <div className="mt-5 space-y-3">
            {topVendors.length ? topVendors.map((vendor, index) => (
              <div key={vendor.id || vendor.storeSlug || vendor.name} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">#{index + 1} {vendor.name}</p>
                  <p className="text-xs text-slate-500">/{vendor.storeSlug} • {vendor.records} payout records</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-emerald-700">{formatCurrency(vendor.total)}</p>
                  <p className="text-xs text-slate-500">Paid {formatCurrency(vendor.paid)}</p>
                </div>
              </div>
            )) : <PageState tone="info" title="No vendor ranking yet" description="Top vendors will appear once settlement records are available." />}
          </div>
        </article>

        <article className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Settlement Speed</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">How fast payouts are being completed</h2>
          <div className="mt-5 grid gap-3">
            {[
              { label: "Average turnaround", value: performance.averageDays !== null ? `${performance.averageDays} days` : "No data yet", tone: "text-emerald-700" },
              { label: "Fastest payout", value: performance.fastestDays !== null ? `${performance.fastestDays} days` : "No data yet", tone: "text-sky-700" },
              { label: "Slowest payout", value: performance.slowestDays !== null ? `${performance.slowestDays} days` : "No data yet", tone: "text-rose-700" },
              { label: "Paid settlements", value: performance.settledCount || 0, tone: "text-violet-700" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                <p className={`mt-2 text-2xl font-black ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-[28px] border border-amber-100 bg-[linear-gradient(135deg,#fffaf0_0%,#ffffff_100%)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-500">Settlement Queue</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Orders ready for vendor settlement</h2>
            <p className="text-sm text-slate-500">Create a payout record once a delivered order is ready to move into settlement tracking.</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            {readyQueue.length} queued
          </span>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {readyQueue.map((entry) => (
            <article key={entry._id} className="rounded-[24px] border border-white/80 bg-white/92 p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
              <p className="text-sm font-semibold text-slate-900">{entry.vendor?.storeName || entry.vendor?.name}</p>
              <p className="mt-1 text-xs text-slate-500">Order #{entry.orderId}</p>
              <p className="mt-3 text-2xl font-black text-amber-700">{formatCurrency(entry.amount)}</p>
              <p className="mt-2 text-sm text-slate-500">{entry.items?.length || 0} item lines ready for settlement</p>
              <button
                type="button"
                onClick={() => createRecord(entry)}
                disabled={submittingId === entry._id}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
              >
                <FiCreditCard /> {submittingId === entry._id ? "Saving..." : "Create Settlement"}
              </button>
            </article>
          ))}
          {!readyQueue.length ? (
            <PageState tone="info" title="Nothing waiting" description="Delivered orders will appear here once they are ready for settlement." />
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/92 shadow-[0_20px_40px_rgba(15,23,42,0.07)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_100%)] text-left text-slate-600">
              <tr>
                <th className="p-3">Vendor</th>
                <th className="p-3">Order</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Notes</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record._id} className="border-t border-slate-100 align-top">
                  <td className="p-3">
                    <p className="font-semibold text-slate-900">{record.vendor?.storeName || record.vendor?.name}</p>
                    <p className="text-xs text-slate-500">/{record.vendor?.storeSlug || "store"}</p>
                  </td>
                  <td className="p-3">
                    <p className="font-semibold text-slate-800">Order #{record.order?.id || record.orderId}</p>
                    <p className="text-xs text-slate-500">{record.order?.status?.replaceAll("_", " ") || "n/a"}</p>
                  </td>
                  <td className="p-3 font-semibold text-slate-900">{formatCurrency(record.amount)}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone[record.status] || statusTone.pending}`}>
                      {record.status.replaceAll("_", " ")}
                    </span>
                    {record.paidAt ? <p className="mt-2 text-xs text-slate-400">Paid {new Date(record.paidAt).toLocaleString()}</p> : null}
                  </td>
                  <td className="p-3 text-sm text-slate-600">{record.notes || "No notes yet"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {record.status !== "paid" ? (
                        <button
                          type="button"
                          onClick={() => updateStatus(record, "paid")}
                          disabled={submittingId === record._id}
                          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                        >
                          Mark Paid
                        </button>
                      ) : null}
                      {record.status !== "on_hold" ? (
                        <button
                          type="button"
                          onClick={() => updateStatus(record, "on_hold")}
                          disabled={submittingId === record._id}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                        >
                          Put On Hold
                        </button>
                      ) : null}
                      {record.status !== "pending" ? (
                        <button
                          type="button"
                          onClick={() => updateStatus(record, "pending")}
                          disabled={submittingId === record._id}
                          className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-60"
                        >
                          Reopen
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!records.length ? (
                <tr>
                  <td colSpan="6" className="p-6">
                    <PageState tone="info" title="No payout records yet" description="Create the first settlement from the queue above." />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
