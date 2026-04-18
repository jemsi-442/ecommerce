import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiCreditCard, FiDownload, FiPauseCircle } from "react-icons/fi";
import axios from "../utils/axios";
import { extractList, extractOne } from "../utils/apiShape";
import PageState from "../components/PageState";
import PayoutTrendCharts from "../components/PayoutTrendCharts";
import { useToast } from "../hooks/useToast";
import { buildBestPayoutMonth, buildPayoutStatusChartData, buildPayoutTrendData, buildSettlementPerformance } from "../utils/payoutAnalytics";
import { getPayoutStatusTone } from "../utils/statusStyles";

const formatCurrency = (value) => `Tsh ${Number(value || 0).toLocaleString()}`;

export default function VendorPayouts() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [records, setRecords] = useState([]);
  const [readyQueue, setReadyQueue] = useState([]);
  const [summary, setSummary] = useState({
    totalPaid: 0,
    pendingAmount: 0,
    readyQueueAmount: 0,
    paidRecords: 0,
  });
  const [exporting, setExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const loadPayouts = async () => {
      setLoading(true);
      try {
        const params = {
          ...(statusFilter !== "all" ? { status: statusFilter } : {}),
          ...(fromDate ? { from: fromDate } : {}),
          ...(toDate ? { to: toDate } : {}),
        };
        const { data } = await axios.get("/vendor/payouts", { params });
        setRecords(extractList(data, ["payouts", "items"]));
        setReadyQueue(extractOne(data)?.readyQueue || []);
        setSummary(extractOne(data)?.summary || { totalPaid: 0, pendingAmount: 0, readyQueueAmount: 0, paidRecords: 0 });
        setError("");
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load payout history.");
      } finally {
        setLoading(false);
      }
    };

    loadPayouts();
  }, [statusFilter, fromDate, toDate]);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return records;
    }

    return records.filter((record) => {
      const searchableText = [
        record.order?.id,
        record.orderId,
        record.order?.paymentReference,
        record.status,
        record.notes,
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
      const searchableText = [entry.orderId, entry.amount, entry.items?.length]
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
      const response = await axios.get("/vendor/payouts/export.csv", {
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
      link.download = "vendor-payout-history-" + new Date().toISOString().slice(0, 10) + ".csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Payout report downloaded");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to download payout report");
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
  };

  if (loading) {
    return <PageState title="Loading payouts" description="Collecting your latest settlement activity..." />;
  }

  if (error) {
    return <PageState tone="error" title="Payouts unavailable" description={error} />;
  }

  const trendData = buildPayoutTrendData(records);
  const statusData = buildPayoutStatusChartData(records, readyQueue);
  const performance = buildSettlementPerformance(records);
  const bestMonth = buildBestPayoutMonth(records);

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="rounded-[28px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_48%,#fff7ed_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Settlement History</p>
        <h1 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">Vendor Payouts</h1>
        <p className="mt-2 text-slate-500">See what has already been paid out, what is being settled, and what is still waiting in the queue.</p>
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

      <section className="rounded-[26px] border border-white/80 bg-white/92 p-4 shadow-[0_18px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Filter Payouts</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Review the exact settlements you want</h2>
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
              placeholder="Search by order, reference, notes, or status"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#102A43]/35"
            />
            <p className="text-xs text-slate-500">
              {paginationLabel} and {filteredReadyQueue.length} waiting {filteredReadyQueue.length === 1 ? "entry" : "entries"} match the current filters.
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
              Your on-screen list and CSV export use these filters together.
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

      <PayoutTrendCharts trendData={trendData} statusData={statusData} tone="amber" />

      <section className="grid gap-4 xl:grid-cols-3">
        <AnalyticsNote
          label="Queue note"
          title={readyQueue.length ? `${readyQueue.length} delivered orders are still waiting for settlement` : "No delivered orders are waiting for settlement right now"}
          detail={
            readyQueue.length
              ? `${formatCurrency(summary.readyQueueAmount)} is still waiting for an admin settlement record.`
              : "As soon as delivered orders become settlement-ready, they will appear here."
          }
          tone="orange"
        />
        <AnalyticsNote
          label="History note"
          title={bestMonth.amount > 0 ? `${bestMonth.label} is your best payout month so far` : "Your best payout month will appear after the first full cycle"}
          detail={
            bestMonth.amount > 0
              ? `${formatCurrency(bestMonth.amount)} was paid in that month, making it your strongest payout period so far.`
              : "As paid settlements begin to build up, this note will highlight your strongest month."
          }
          tone="navy"
        />
        <AnalyticsNote
          label="Speed note"
          title={performance.averageDays !== null ? `Your average payout speed is ${performance.averageDays} days` : "Payout speed will appear after the first paid records"}
          detail={
            performance.averageDays !== null
              ? `The fastest payout took ${performance.fastestDays} days and the slowest took ${performance.slowestDays} days across ${performance.settledCount} paid settlements.`
              : "Once some records move from pending to paid, this note will summarize your payout turnaround."
          }
          tone="slate"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Average payout speed", value: performance.averageDays !== null ? `${performance.averageDays} days` : "No data yet", tone: "text-orange-700", accent: "bg-orange-100 text-orange-600" },
          { label: "Fastest payout", value: performance.fastestDays !== null ? `${performance.fastestDays} days` : "No data yet", tone: "text-[#102A43]", accent: "bg-slate-100 text-[#102A43]" },
          { label: "Best paid month", value: bestMonth.label, tone: "text-[#102A43]", accent: "bg-slate-100 text-[#102A43]" },
          { label: "Best month value", value: formatCurrency(bestMonth.amount), tone: "text-slate-700", accent: "bg-slate-100 text-slate-600" },
        ].map((item) => (
          <article key={item.label} className="surface-panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                <p className={`mt-3 text-2xl font-black ${item.tone}`}>{item.value}</p>
              </div>
              <span className={`rounded-2xl p-3 ${item.accent}`}>
                <FiCreditCard size={18} />
              </span>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Ready for Settlement", value: formatCurrency(summary.readyQueueAmount), icon: FiClock, tone: "text-orange-700", accent: "bg-orange-100 text-orange-600" },
          { label: "Pending Settlements", value: formatCurrency(summary.pendingAmount), icon: FiPauseCircle, tone: "text-[#102A43]", accent: "bg-slate-100 text-[#102A43]" },
          { label: "Paid Out", value: formatCurrency(summary.totalPaid), icon: FiCheckCircle, tone: "text-[#102A43]", accent: "bg-slate-100 text-[#102A43]" },
          { label: "Paid Records", value: summary.paidRecords || 0, icon: FiCreditCard, tone: "text-slate-700", accent: "bg-slate-100 text-slate-600" },
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

      <section className="relative overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,251,235,0.96)_0%,rgba(255,255,255,0.96)_42%,rgba(248,250,252,0.96)_100%)] p-5 shadow-[0_26px_60px_rgba(15,23,42,0.08)]">
        <div className="pointer-events-none absolute right-[-10%] top-[-20%] h-44 w-44 rounded-full bg-orange-200/35 blur-3xl" />
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#102A43]">Awaiting Settlement</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Delivered orders not settled yet</h2>
            <p className="text-sm text-slate-500">These orders are ready, but the admin has not yet created a payout record for them.</p>
          </div>
          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
            {readyQueue.length} waiting
          </span>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {filteredReadyQueue.map((entry) => (
            <article key={entry._id} className="rounded-[26px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.92)_100%)] p-4 shadow-[0_18px_42px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_52px_rgba(15,23,42,0.11)]">
              <p className="font-semibold text-slate-900">Order #{entry.orderId}</p>
              <p className="mt-1 text-xs text-slate-500">{entry.items?.length || 0} item lines</p>
              <div className="mt-3 inline-flex rounded-full border border-orange-200/80 bg-orange-50/90 px-3 py-1.5 text-lg font-black text-orange-700 shadow-sm">
                {formatCurrency(entry.amount)}
              </div>
              <p className="mt-2 text-sm text-slate-500">Waiting for admin settlement record</p>
            </article>
          ))}
          {!filteredReadyQueue.length ? (
            <PageState tone="info" title="Nothing waiting" description="Once your delivered orders are ready, they will appear here until settlement is recorded." />
          ) : null}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,252,0.94)_100%)] shadow-[0_24px_52px_rgba(15,23,42,0.08)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(242,140,40,0.14)_0%,rgba(242,140,40,0)_72%)]" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="sticky top-0 z-10 bg-[linear-gradient(135deg,rgba(255,247,237,0.98)_0%,rgba(248,250,252,0.98)_100%)] text-left text-slate-600 backdrop-blur">
              <tr>
                <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">Order</th>
                <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">Amount</th>
                <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">Status</th>
                <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">Notes</th>
                <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">Timeline</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.map((record) => (
                <tr key={record._id} className="border-t border-slate-100/80 align-top transition hover:bg-slate-50/75">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-900">Order #{record.order?.id || record.orderId}</p>
                    <p className="text-xs text-slate-500">{record.order?.paymentReference || "No payment ref"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full border border-orange-200/80 bg-orange-50/90 px-3 py-1.5 font-semibold text-orange-700 shadow-sm">
                      {formatCurrency(record.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getPayoutStatusTone(record.status)}`}>
                      {record.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">{record.notes || "No notes yet"}</td>
                  <td className="px-4 py-4 text-sm text-slate-500">
                    <p>Created {new Date(record.createdAt).toLocaleString()}</p>
                    {record.paidAt ? <p className="mt-1">Paid {new Date(record.paidAt).toLocaleString()}</p> : null}
                  </td>
                </tr>
              ))}
              {!filteredRecords.length ? (
                <tr>
                  <td colSpan="5" className="p-8">
                    <PageState tone="info" title="No payout records yet" description="Once admin starts settling your orders, the history will appear here." />
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
