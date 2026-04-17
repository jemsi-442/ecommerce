import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["#0f766e", "#10b981", "#f59e0b", "#0ea5e9", "#f97316", "#64748b"];

export default function DashboardCharts({ revenueByDay = [], pieData = [] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-6">
      <div className="rounded-[24px] border border-emerald-100 bg-[linear-gradient(135deg,#ffffff_0%,#ecfdf5_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <h2 className="mb-4 text-base font-black text-slate-900">Sales This Week</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={revenueByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
            <XAxis dataKey="_id" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip />
            <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-[24px] border border-amber-100 bg-[linear-gradient(135deg,#ffffff_0%,#fff7ed_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <h2 className="mb-4 text-base font-black text-slate-900">Order Journey</h2>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} label>
              {pieData.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
