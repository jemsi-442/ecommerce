import { useEffect, useState } from "react";
import { FiCheckCircle, FiClock, FiCreditCard, FiDownload, FiPauseCircle } from "react-icons/fi";
import axios from "../utils/axios";
import { extractList, extractOne } from "../utils/apiShape";
import PageState from "../components/PageState";
import PayoutTrendCharts from "../components/PayoutTrendCharts";
import { useToast } from "../hooks/useToast";
import { buildBestPayoutMonth, buildPayoutStatusChartData, buildPayoutTrendData, buildSettlementPerformance } from "../utils/payoutAnalytics";

const formatCurrency = (value) => `Tsh ${Number(value || 0).toLocaleString()}`;

const statusTone = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  on_hold: "bg-rose-100 text-rose-700",
};

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
      <section className="rounded-[28px] border border-amber-100 bg-[linear-gradient(135deg,#fffaf0_0%,#ffffff_48%,#f8fafc_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-500">Settlement History</p>
        <h1 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">Vendor Payouts</h1>
        <p className="mt-2 text-slate-500">See what has already been paid out, what is being settled, and what is still waiting in the queue.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={downloadReport}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
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
          <label className="space-y-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-amber-300"
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
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-amber-300"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-amber-300"
            />
          </label>
          <div className="flex items-end">
            <div className="w-full rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Your on-screen list and CSV export use these filters together.
            </div>
          </div>
        </div>
      </section>

      <PayoutTrendCharts trendData={trendData} statusData={statusData} tone="amber" />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Average payout speed", value: performance.averageDays !== null ? `${performance.averageDays} days` : "No data yet", tone: "text-amber-700", accent: "bg-amber-100 text-amber-600" },
          { label: "Fastest payout", value: performance.fastestDays !== null ? `${performance.fastestDays} days` : "No data yet", tone: "text-sky-700", accent: "bg-sky-100 text-sky-600" },
          { label: "Best paid month", value: bestMonth.label, tone: "text-emerald-700", accent: "bg-emerald-100 text-emerald-600" },
          { label: "Best month value", value: formatCurrency(bestMonth.amount), tone: "text-violet-700", accent: "bg-violet-100 text-violet-600" },
        ].map((item) => (
          <article key={item.label} className="rounded-[24px] border border-white/80 bg-white/92 p-5 shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
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
          { label: "Ready for Settlement", value: formatCurrency(summary.readyQueueAmount), icon: FiClock, tone: "text-amber-700", accent: "bg-amber-100 text-amber-600" },
          { label: "Pending Settlements", value: formatCurrency(summary.pendingAmount), icon: FiPauseCircle, tone: "text-sky-700", accent: "bg-sky-100 text-sky-600" },
          { label: "Paid Out", value: formatCurrency(summary.totalPaid), icon: FiCheckCircle, tone: "text-emerald-700", accent: "bg-emerald-100 text-emerald-600" },
          { label: "Paid Records", value: summary.paidRecords || 0, icon: FiCreditCard, tone: "text-violet-700", accent: "bg-violet-100 text-violet-600" },
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

      <section className="rounded-[28px] border border-amber-100 bg-[linear-gradient(135deg,#fffaf0_0%,#ffffff_100%)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-500">Awaiting Settlement</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Delivered orders not settled yet</h2>
            <p className="text-sm text-slate-500">These orders are ready, but the admin has not yet created a payout record for them.</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            {readyQueue.length} waiting
          </span>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {readyQueue.map((entry) => (
            <article key={entry._id} className="rounded-[24px] border border-white/80 bg-white/92 p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
              <p className="font-semibold text-slate-900">Order #{entry.orderId}</p>
              <p className="mt-1 text-xs text-slate-500">{entry.items?.length || 0} item lines</p>
              <p className="mt-3 text-2xl font-black text-amber-700">{formatCurrency(entry.amount)}</p>
              <p className="mt-2 text-sm text-slate-500">Waiting for admin settlement record</p>
            </article>
          ))}
          {!readyQueue.length ? (
            <PageState tone="info" title="Nothing waiting" description="Once your delivered orders are ready, they will appear here until settlement is recorded." />
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/92 shadow-[0_20px_40px_rgba(15,23,42,0.07)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_100%)] text-left text-slate-600">
              <tr>
                <th className="p-3">Order</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Notes</th>
                <th className="p-3">Timeline</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record._id} className="border-t border-slate-100 align-top">
                  <td className="p-3">
                    <p className="font-semibold text-slate-900">Order #{record.order?.id || record.orderId}</p>
                    <p className="text-xs text-slate-500">{record.order?.paymentReference || "No payment ref"}</p>
                  </td>
                  <td className="p-3 font-semibold text-slate-900">{formatCurrency(record.amount)}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone[record.status] || statusTone.pending}`}>
                      {record.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-slate-600">{record.notes || "No notes yet"}</td>
                  <td className="p-3 text-sm text-slate-500">
                    <p>Created {new Date(record.createdAt).toLocaleString()}</p>
                    {record.paidAt ? <p className="mt-1">Paid {new Date(record.paidAt).toLocaleString()}</p> : null}
                  </td>
                </tr>
              ))}
              {!records.length ? (
                <tr>
                  <td colSpan="5" className="p-6">
                    <PageState tone="info" title="No payout records yet" description="Once admin starts settling your orders, the history will appear here." />
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
