import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiCreditCard, FiDownload, FiPauseCircle } from "react-icons/fi";
import axios from "../../utils/axios";
import { extractList, extractOne } from "../../utils/apiShape";
import PageState from "../../components/PageState";
import PayoutTrendCharts from "../../components/PayoutTrendCharts";
import { useToast } from "../../hooks/useToast";
import { TableSkeleton } from "../../components/Skeleton";
import { buildPayoutStatusChartData, buildPayoutTrendData, buildSettlementPerformance, buildTopVendorPayouts } from "../../utils/payoutAnalytics";
import { getPayoutStatusTone } from "../../utils/statusStyles";

const formatCurrency = (value) => `Tsh ${Number(value || 0).toLocaleString()}`;

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
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

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

  const filteredRecords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return records;
    }

    return records.filter((record) => {
      const searchableText = [
        record.vendor?.storeName,
        record.vendor?.name,
        record.vendor?.storeSlug,
        record.order?.id,
        record.orderId,
        record.order?.payment?.reference,
        record.notes,
        record.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [records, searchQuery]);

  const filteredReadyQueue = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return readyQueue;
    }

    return readyQueue.filter((entry) => {
      const searchableText = [
        entry.vendor?.storeName,
        entry.vendor?.name,
        entry.vendor?.storeSlug,
        entry.orderId,
        entry.amount,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [readyQueue, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, searchQuery, statusFilter, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRecords.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredRecords, pageSize]);

  const paginationLabel = useMemo(() => {
    if (!filteredRecords.length) {
      return "Showing 0 results";
    }

    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, filteredRecords.length);
    return `Showing ${start}-${end} of ${filteredRecords.length}`;
  }, [currentPage, filteredRecords.length, pageSize]);

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
      <section className="overflow-hidden rounded-[28px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_42%,#fff7ed_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Vendor Settlements</p>
        <h1 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">Payout Management</h1>
        <p className="mt-1 text-sm text-slate-500">Queue vendor settlements, mark payouts as paid, and track anything on hold.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={downloadReport}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-semibold text-orange-700 transition hover:bg-orange-50 disabled:opacity-60"
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
          <label className="space-y-2 text-sm text-slate-600 md:col-span-3 xl:col-span-4">
            <span className="font-semibold text-slate-700">Search</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by vendor, store slug, order, notes, or reference"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#102A43]/35"
            />
            <p className="text-xs text-slate-500">
              {paginationLabel} and {filteredReadyQueue.length} queue {filteredReadyQueue.length === 1 ? "entry" : "entries"} match the current filters.
            </p>
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#102A43]/35"
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
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#102A43]/35"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#102A43]/35"
            />
          </label>
          <div className="flex items-end">
            <div className="w-full rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-700">
              Reports and CSV export use these filters automatically.
            </div>
          </div>
          <label className="space-y-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">Rows per page</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value) || 10)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#102A43]/35"
            >
              <option value={10}>10 rows</option>
              <option value={20}>20 rows</option>
              <option value={50}>50 rows</option>
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Ready to Settle", value: formatCurrency(summary.readyQueueAmount), icon: FiClock, tone: "text-orange-700", accent: "bg-orange-100 text-orange-600" },
          { label: "Pending Records", value: summary.pendingRecords || 0, icon: FiPauseCircle, tone: "text-[#102A43]", accent: "bg-slate-100 text-[#102A43]" },
          { label: "Paid Out", value: formatCurrency(summary.totalPaid), icon: FiCheckCircle, tone: "text-[#102A43]", accent: "bg-slate-100 text-[#102A43]" },
          { label: "Settlement Records", value: summary.totalRecords || 0, icon: FiCreditCard, tone: "text-slate-700", accent: "bg-slate-100 text-slate-600" },
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

      <PayoutTrendCharts trendData={trendData} statusData={statusData} tone="emerald" />

      <section className="grid gap-4 xl:grid-cols-3">
        <AnalyticsNote
          label="Queue note"
          title={readyQueue.length ? `${readyQueue.length} settlements are ready to be created` : "No settlement queue is building right now"}
          detail={
            readyQueue.length
              ? `${formatCurrency(summary.readyQueueAmount)} is ready to move into vendor settlement records as soon as the queue is processed.`
              : "Delivered orders will appear here once they are ready for settlement."
          }
          tone="orange"
        />
        <AnalyticsNote
          label="Vendor note"
          title={topVendors[0]?.name ? `${topVendors[0].name} is leading settlement value` : "There is no payout leader yet"}
          detail={
            topVendors[0]
              ? `${formatCurrency(topVendors[0].total)} across ${topVendors[0].records} records, with ${formatCurrency(topVendors[0].paid)} already paid out.`
              : "As settlement records build up, this note will show which vendor is carrying the biggest payout load."
          }
          tone="navy"
        />
        <AnalyticsNote
          label="Speed note"
          title={performance.averageDays !== null ? `Average settlement time is ${performance.averageDays} days` : "Settlement speed will appear after the first paid records"}
          detail={
            performance.averageDays !== null
              ? `The fastest payout took ${performance.fastestDays} days and the slowest took ${performance.slowestDays} days across ${performance.settledCount} paid settlements.`
              : "As payouts start moving from pending to paid, this note will summarize turnaround speed."
          }
          tone="slate"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="surface-panel-lg p-5">
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
                  <p className="text-sm font-black text-[#102A43]">{formatCurrency(vendor.total)}</p>
                  <p className="text-xs text-slate-500">Paid {formatCurrency(vendor.paid)}</p>
                </div>
              </div>
            )) : <PageState tone="info" title="No vendor ranking yet" description="Top vendors will appear once settlement records are available." />}
          </div>
        </article>

        <article className="surface-panel-lg p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Settlement Speed</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">How fast payouts are being completed</h2>
          <div className="mt-5 grid gap-3">
            {[
              { label: "Average turnaround", value: performance.averageDays !== null ? `${performance.averageDays} days` : "No data yet", tone: "text-[#102A43]" },
              { label: "Fastest payout", value: performance.fastestDays !== null ? `${performance.fastestDays} days` : "No data yet", tone: "text-orange-700" },
              { label: "Slowest payout", value: performance.slowestDays !== null ? `${performance.slowestDays} days` : "No data yet", tone: "text-red-700" },
              { label: "Paid settlements", value: performance.settledCount || 0, tone: "text-slate-700" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                <p className={`mt-2 text-2xl font-black ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="relative overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(135deg,rgba(239,246,255,0.96)_0%,rgba(255,255,255,0.96)_42%,rgba(255,247,237,0.96)_100%)] p-5 shadow-[0_26px_60px_rgba(15,23,42,0.08)]">
        <div className="pointer-events-none absolute right-[-10%] top-[-20%] h-44 w-44 rounded-full bg-orange-200/35 blur-3xl" />
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#102A43]">Settlement Queue</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Orders ready for vendor settlement</h2>
            <p className="text-sm text-slate-500">Create a payout record once a delivered order is ready to move into settlement tracking.</p>
          </div>
          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
            {readyQueue.length} queued
          </span>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {filteredReadyQueue.map((entry) => (
              <article key={entry._id} className="rounded-[26px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.92)_100%)] p-4 shadow-[0_18px_42px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_52px_rgba(15,23,42,0.11)]">
              <p className="text-sm font-semibold text-slate-900">{entry.vendor?.storeName || entry.vendor?.name}</p>
              <p className="mt-1 text-xs text-slate-500">Order #{entry.orderId}</p>
              <div className="mt-3 inline-flex rounded-full border border-orange-200/80 bg-orange-50/90 px-3 py-1.5 text-lg font-black text-orange-700 shadow-sm">
                {formatCurrency(entry.amount)}
              </div>
              <p className="mt-2 text-sm text-slate-500">{entry.items?.length || 0} item lines ready for settlement</p>
              <button
                type="button"
                onClick={() => createRecord(entry)}
                disabled={submittingId === entry._id}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 font-semibold text-orange-700 transition hover:bg-orange-100 disabled:opacity-60"
              >
                <FiCreditCard /> {submittingId === entry._id ? "Saving..." : "Create Settlement"}
              </button>
            </article>
          ))}
          {!filteredReadyQueue.length ? (
            <PageState tone="info" title="Nothing waiting" description="Delivered orders will appear here once they are ready for settlement." />
          ) : null}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,252,0.94)_100%)] shadow-[0_24px_52px_rgba(15,23,42,0.08)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(242,140,40,0.12)_0%,rgba(242,140,40,0)_72%)]" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="sticky top-0 z-10 bg-[linear-gradient(135deg,rgba(239,246,255,0.96)_0%,rgba(255,247,237,0.98)_100%)] text-left text-slate-600 backdrop-blur">
              <tr>
                <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">Vendor</th>
                <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">Order</th>
                <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">Amount</th>
                <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">Status</th>
                <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">Notes</th>
                <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.map((record) => (
                <tr key={record._id} className="border-t border-slate-100/80 align-top transition hover:bg-slate-50/75">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-900">{record.vendor?.storeName || record.vendor?.name}</p>
                    <p className="text-xs text-slate-500">/{record.vendor?.storeSlug || "store"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-800">Order #{record.order?.id || record.orderId}</p>
                    <p className="text-xs text-slate-500">{record.order?.status?.replaceAll("_", " ") || "n/a"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full border border-[#102A43]/10 bg-slate-100/80 px-3 py-1.5 font-semibold text-[#102A43] shadow-sm">
                      {formatCurrency(record.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getPayoutStatusTone(record.status)}`}>
                      {record.status.replaceAll("_", " ")}
                    </span>
                    {record.paidAt ? <p className="mt-2 text-xs text-slate-400">Paid {new Date(record.paidAt).toLocaleString()}</p> : null}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">{record.notes || "No notes yet"}</td>
                  <td className="px-4 py-4">
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
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                        >
                          Put On Hold
                        </button>
                      ) : null}
                      {record.status !== "pending" ? (
                        <button
                          type="button"
                          onClick={() => updateStatus(record, "pending")}
                          disabled={submittingId === record._id}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-[#102A43] transition hover:bg-slate-100 disabled:opacity-60"
                        >
                          Reopen
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredRecords.length ? (
                <tr>
                  <td colSpan="6" className="p-8">
                    <PageState tone="info" title="No payout records yet" description="Create the first settlement from the queue above." />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {filteredRecords.length > 0 ? (
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
      </section>
    </div>
  );
}

function AnalyticsNote({ label, title, detail, tone = "slate" }) {
  const toneMap = {
    navy: "border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_100%)]",
    orange: "border-orange-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_100%)]",
    slate: "border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_100%)]",
  };

  return (
    <article className={`surface-panel p-5 ${toneMap[tone] || toneMap.slate}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <h3 className="mt-2 text-base font-black text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
    </article>
  );
}
