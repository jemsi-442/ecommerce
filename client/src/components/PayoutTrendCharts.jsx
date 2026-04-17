import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#6366f1", "#06b6d4"];

const money = (value) => `Tsh ${Number(value || 0).toLocaleString()}`;

export default function PayoutTrendCharts({ trendData = [], statusData = [], tone = "emerald" }) {
  const accent = tone === "amber" ? "#f59e0b" : "#10b981";
  const secondary = tone === "amber" ? "#fb923c" : "#34d399";

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <article className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Payout Momentum</p>
        <h2 className="mt-1 text-lg font-black text-slate-900">Recent settlement trend</h2>
        <p className="mt-1 text-sm text-slate-500">Track how much is being paid, waiting, or held across recent periods.</p>
        <div className="mt-5 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip formatter={(value) => money(value)} />
              <Legend />
              <Bar dataKey="paid" name="Paid" fill={accent} radius={[8, 8, 0, 0]} />
              <Bar dataKey="pending" name="Pending" fill={secondary} radius={[8, 8, 0, 0]} />
              <Bar dataKey="onHold" name="On Hold" fill="#f87171" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Payout Mix</p>
        <h2 className="mt-1 text-lg font-black text-slate-900">Where settlement value is sitting</h2>
        <p className="mt-1 text-sm text-slate-500">See how your current payout value is split across paid, pending, on-hold, and queue value.</p>
        <div className="mt-5 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={95} label>
                {statusData.map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => money(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}
