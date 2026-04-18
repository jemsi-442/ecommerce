import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";

const COLORS = ["#102A43", "#F28C28", "#1C4268", "#FDBA74", "#DC2626", "#94A3B8"];

const formatCurrency = (value) => `Tsh ${Number(value || 0).toLocaleString()}`;

const formatCompact = (value) =>
  new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));

const formatDelta = (value) => `${value > 0 ? "+" : ""}${Number(value || 0).toFixed(1)}%`;

const sum = (items, key) => items.reduce((total, item) => total + Number(item[key] || 0), 0);

const formatDayLabel = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return String(value || "Now");
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

function SalesTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload || {};
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 text-white shadow-[0_18px_35px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-200/85">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{formatCurrency(point.revenue)}</p>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-300">
        <span>{Number(point.orders || 0).toLocaleString()} orders</span>
        <span className="h-1 w-1 rounded-full bg-slate-500" />
        <span>{formatCurrency(point.avgTicket || 0)} average order value</span>
      </div>
    </div>
  );
}

function MixTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0];
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 text-white shadow-[0_18px_35px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">{entry.name}</p>
      <p className="mt-2 text-xl font-black" style={{ color: entry.color }}>
        {Number(entry.value || 0).toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-slate-400">orders in this stage</p>
    </div>
  );
}

export default function DashboardCharts({ revenueByDay = [], pieData = [] }) {
  const chartData = revenueByDay.map((entry) => {
    const revenue = Number(entry.revenue || 0);
    const orders = Number(entry.orders || 0);
    return {
      ...entry,
      label: formatDayLabel(entry._id || entry.date),
      revenue,
      orders,
      avgTicket: orders ? revenue / orders : 0,
    };
  });

  const totalRevenue = sum(chartData, "revenue");
  const totalOrders = sum(chartData, "orders");
  const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
  const avgDailyRevenue = chartData.length ? totalRevenue / chartData.length : 0;
  const avgOrdersPerDay = chartData.length ? totalOrders / chartData.length : 0;
  const peakRevenue = chartData.reduce((max, entry) => Math.max(max, Number(entry.revenue || 0)), 0);
  const peakOrders = chartData.reduce((max, entry) => Math.max(max, Number(entry.orders || 0)), 0);
  const latestPoint = chartData[chartData.length - 1] || { revenue: 0, orders: 0, avgTicket: 0 };

  const recentWindow = chartData.slice(-7);
  const previousWindow = chartData.slice(-14, -7);
  const recentRevenue = sum(recentWindow, "revenue");
  const previousRevenue = sum(previousWindow, "revenue");
  const recentOrders = sum(recentWindow, "orders");
  const previousOrders = sum(previousWindow, "orders");
  const revenueDelta = previousRevenue
    ? ((recentRevenue - previousRevenue) / previousRevenue) * 100
    : recentRevenue > 0
      ? 100
      : 0;
  const orderDelta = previousOrders
    ? ((recentOrders - previousOrders) / previousOrders) * 100
    : recentOrders > 0
      ? 100
      : 0;

  const strongestDay =
    chartData.slice().sort((left, right) => right.revenue - left.revenue)[0] || null;
  const weakestDay =
    chartData.slice().sort((left, right) => left.revenue - right.revenue)[0] || null;

  const mixData = pieData.map((entry, index) => ({
    ...entry,
    value: Number(entry.value || 0),
    fill: COLORS[index % COLORS.length],
  }));
  const hasTrendData = chartData.length > 0;
  const hasMixData = mixData.length > 0;
  const totalMix = sum(mixData, "value");
  const dominantStage = mixData
    .slice()
    .sort((left, right) => Number(right.value || 0) - Number(left.value || 0))[0] || null;
  const dominantShare = totalMix && dominantStage ? (dominantStage.value / totalMix) * 100 : 0;
  const revenueVsBenchmark = avgDailyRevenue ? (latestPoint.revenue / avgDailyRevenue) * 100 : 0;
  const ordersVsBenchmark = avgOrdersPerDay ? (latestPoint.orders / avgOrdersPerDay) * 100 : 0;
  const ticketVsBenchmark = avgOrderValue ? (latestPoint.avgTicket / avgOrderValue) * 100 : 0;
  const stageBalanceScore = Math.max(0, 100 - dominantShare);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_0.82fr]">
      <motion.article
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        whileHover={{ y: -4 }}
        className="relative min-w-0 overflow-hidden rounded-[30px] border border-[#102A43]/15 bg-[linear-gradient(145deg,#0b1525_0%,#102A43_36%,#111827_100%)] p-5 text-white shadow-[0_28px_65px_rgba(3,7,18,0.34)] md:p-6"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(242,140,40,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.14),transparent_28%)]" />
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-orange-400/10 blur-3xl" />

        <div className="relative">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-200/85">
                  Sales Performance
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Last 30 days
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Compare previous period
                </span>
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
                Revenue and order activity in a clearer business view
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                See sales momentum, your normal daily average, and how this week compares with the previous one in straightforward business language.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm lg:w-[250px]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Quick Read
              </p>
              <div className="mt-3 grid gap-3">
                <MetricRow
                  label="Daily average"
                  value={formatCurrency(avgDailyRevenue)}
                  note={`${chartData.length} selling days`}
                />
                <MetricRow
                  label="Sales change"
                  value={formatDelta(revenueDelta)}
                  note={`${recentOrders.toLocaleString()} orders in the last 7 days`}
                  positive={revenueDelta >= 0}
                />
                <MetricRow
                  label="Order change"
                  value={formatDelta(orderDelta)}
                  note="last 7 days versus the previous 7 days"
                  positive={orderDelta >= 0}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Sales" value={formatCurrency(totalRevenue)} accent="text-white" />
            <MetricCard label="Average per Day" value={formatCurrency(avgDailyRevenue)} accent="text-orange-300" />
            <MetricCard label="Average Order Value" value={formatCurrency(avgOrderValue)} accent="text-slate-100" />
            <MetricCard
              label="Best Day"
              value={formatCurrency(peakRevenue)}
              accent="text-orange-200"
            />
          </div>

          <div className="mt-6 rounded-[26px] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <LegendPill label="Sales" swatch="bg-[#F28C28]" />
                <LegendPill label="Orders" swatch="bg-slate-200" />
                <LegendPill label="Average" swatch="bg-white/60" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <InfoPill label="Latest sales" value={formatCurrency(latestPoint.revenue)} tone="navy" />
                <InfoPill label="Orders" value={Number(latestPoint.orders || 0).toLocaleString()} tone="slate" />
                <InfoPill label="Average" value={formatCurrency(avgDailyRevenue)} tone="orange" />
              </div>
            </div>

            <div className="mt-4 h-[280px] sm:h-[320px] lg:h-[340px]">
              {hasTrendData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F28C28" stopOpacity={0.45} />
                        <stop offset="52%" stopColor="#102A43" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#081B2E" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="dashboardRevenueStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#F28C28" />
                        <stop offset="100%" stopColor="#FDBA74" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.12)" strokeDasharray="4 8" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                    />
                    <YAxis
                      yAxisId="sales"
                      tickLine={false}
                      axisLine={false}
                      width={60}
                      tickFormatter={(value) => formatCompact(value)}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                    />
                    <YAxis
                      yAxisId="orders"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      width={42}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                    />
                    {avgDailyRevenue > 0 ? (
                      <ReferenceLine
                        yAxisId="sales"
                        y={avgDailyRevenue}
                        stroke="rgba(255,255,255,0.26)"
                        strokeDasharray="6 6"
                      />
                    ) : null}
                    <Tooltip content={<SalesTooltip />} cursor={{ stroke: "rgba(242,140,40,0.28)", strokeWidth: 1 }} />
                    <Area
                      yAxisId="sales"
                      type="monotone"
                      dataKey="revenue"
                      stroke="url(#dashboardRevenueStroke)"
                      strokeWidth={3.5}
                      fill="url(#dashboardRevenueFill)"
                      activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2, fill: "#F28C28" }}
                    />
                    <Area
                      yAxisId="orders"
                      type="monotone"
                      dataKey="orders"
                      stroke="#E2E8F0"
                      strokeWidth={2.2}
                      fill="rgba(255,255,255,0)"
                      activeDot={{ r: 4, stroke: "#0f172a", strokeWidth: 2, fill: "#ffffff" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyState
                  label="Sales trend"
                  title="Waiting for enough sales history"
                  detail="As daily sales and orders build up, this panel will show momentum and the business comparison automatically."
                />
              )}
            </div>

            <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-4">
              <SnapshotCard
                label="Recent 7 Days"
                value={formatCurrency(recentRevenue)}
                detail={`${recentOrders.toLocaleString()} orders recorded`}
              />
              <SnapshotCard
                label="Previous 7 Days"
                value={formatCurrency(previousRevenue)}
                detail={previousWindow.length ? `${previousWindow.length} selling days` : "No comparison period yet"}
              />
              <SnapshotCard
                label="Best Day"
                value={strongestDay ? strongestDay.label : "No data"}
                detail={strongestDay ? formatCurrency(strongestDay.revenue) : "Waiting for sales"}
              />
              <SnapshotCard
                label="Slowest Day"
                value={weakestDay ? weakestDay.label : "No data"}
                detail={weakestDay ? formatCurrency(weakestDay.revenue) : "Waiting for sales"}
              />
            </div>

            <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-2 xl:grid-cols-4">
              <PerformanceLane
                label="Sales vs average"
                value={`${revenueVsBenchmark.toFixed(0)}%`}
                detail="latest day against the daily average"
                progress={revenueVsBenchmark}
                tone="orange"
              />
              <PerformanceLane
                label="Orders vs average"
                value={`${ordersVsBenchmark.toFixed(0)}%`}
                detail="latest order count against the daily average"
                progress={ordersVsBenchmark}
                tone="slate"
              />
              <PerformanceLane
                label="Order value strength"
                value={`${ticketVsBenchmark.toFixed(0)}%`}
                detail="latest average order value against the normal level"
                progress={ticketVsBenchmark}
                tone="orange"
              />
              <PerformanceLane
                label="Order balance"
                value={`${stageBalanceScore.toFixed(0)}%`}
                detail="higher means orders are less concentrated in one stage"
                progress={stageBalanceScore}
                tone="slate"
              />
            </div>
          </div>
        </div>
      </motion.article>

      <motion.article
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
        whileHover={{ y: -4 }}
        className="relative min-w-0 overflow-hidden rounded-[30px] border border-white/90 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_24px_55px_rgba(15,23,42,0.09)] md:p-6"
      >
        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(242,140,40,0.14),transparent_68%)]" />

        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
            Order Breakdown
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
            See where orders are sitting more clearly
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            A quick top summary, exact stage shares, and a short business takeaway below.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SummaryBadge
              label="Total Orders"
              value={Number(totalMix || 0).toLocaleString()}
              detail={`${mixData.length} active stages in the current mix`}
            />
            <SummaryBadge
              label="Leading Share"
              value={`${dominantShare.toFixed(0)}%`}
              detail={dominantStage ? `${dominantStage.name} carries the largest order load` : "Waiting for more order volume"}
            />
          </div>

          <div className="mt-6 rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="grid items-center gap-4 md:grid-cols-[0.92fr_1.08fr]">
              <div className="relative h-[190px] sm:h-[220px]">
                {hasMixData ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={<MixTooltip />} />
                        <Pie
                          data={mixData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={60}
                          outerRadius={88}
                          paddingAngle={3}
                          stroke="rgba(255,255,255,0.08)"
                          strokeWidth={2}
                        >
                          {mixData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="rounded-full border border-white/10 bg-slate-950/80 px-5 py-4 text-center shadow-[0_16px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-400">
                          Total
                        </p>
                        <p className="mt-2 text-3xl font-black text-white">
                          {Number(totalMix || 0).toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">orders in this mix</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <ChartEmptyState
                    label="Order breakdown"
                    title="Waiting for enough order-stage data"
                    detail="As orders start spreading across stages, this panel will show each stage share more clearly."
                    compact
                  />
                )}
              </div>

              <div className="space-y-3">
                {mixData.length ? (
                  mixData.map((entry) => {
                    const share = totalMix ? Math.round((entry.value / totalMix) * 100) : 0;
                    return (
                      <div
                        key={entry.name}
                        className="rounded-[20px] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: entry.fill }}
                            />
                            <div>
                              <p className="text-sm font-semibold text-white">{entry.name}</p>
                              <p className="text-xs text-slate-400">{share}% of all orders</p>
                            </div>
                          </div>
                          <p className="text-lg font-black text-white">
                            {Number(entry.value || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(share, entry.value > 0 ? 8 : 0)}%`,
                              background: `linear-gradient(90deg, ${entry.fill}, rgba(255,255,255,0.92))`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
                    Order-stage mix will appear here as soon as the marketplace records more live order states.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
              <SnapshotCard
                label="Leading Stage"
                value={dominantStage?.name || "No data"}
                detail={dominantStage ? `${dominantStage.value.toLocaleString()} orders` : "Waiting for more orders"}
              />
              <SnapshotCard
                label="Top Share"
                value={`${dominantShare.toFixed(0)}%`}
                detail={dominantStage ? "of the current order mix" : "No stage data yet"}
              />
              <SnapshotCard
                label="Stage Count"
                value={mixData.length.toLocaleString()}
                detail="distinct stages with orders"
              />
            </div>

            <div className="mt-4 grid gap-3 border-t border-white/10 pt-4">
              <InsightRail
                label="Main Focus Area"
                value={dominantStage?.name || "No active stage"}
                detail={
                  dominantStage
                    ? `${dominantShare.toFixed(0)}% of orders are concentrated here right now`
                    : "More order history will sharpen this view"
                }
                tone="orange"
              />
              <InsightRail
                label="Capacity Signal"
                value={`${peakOrders.toLocaleString()} max daily orders`}
                detail="Useful for judging whether the team can handle the busiest order day"
                tone="slate"
              />
            </div>
          </div>
        </div>
      </motion.article>
    </div>
  );
}

function MetricCard({ label, value, accent }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-4 backdrop-blur-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className={`mt-2 text-xl font-black ${accent}`}>{value}</p>
    </div>
  );
}

function MetricRow({ label, value, note, positive = true }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/10 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-slate-300">{label}</p>
        <p className={`text-sm font-black ${positive ? "text-orange-200" : "text-red-300"}`}>{value}</p>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">{note}</p>
    </div>
  );
}

function LegendPill({ label, swatch }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200">
      <span className={`h-2.5 w-2.5 rounded-full ${swatch}`} />
      {label}
    </div>
  );
}

function InfoPill({ label, value, tone = "slate" }) {
  const toneClass = {
    navy: "border-[#102A43]/20 bg-[#102A43]/20 text-white",
    orange: "border-orange-300/20 bg-orange-400/10 text-orange-100",
    slate: "border-white/10 bg-white/[0.06] text-slate-200",
  }[tone];

  return (
    <div className={`rounded-full border px-3 py-1.5 text-xs ${toneClass}`}>
      <span className="font-semibold uppercase tracking-[0.16em] text-slate-300/90">{label}</span>{" "}
      <span className="font-semibold text-inherit">{value}</span>
    </div>
  );
}

function SnapshotCard({ label, value, detail }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function InsightRail({ label, value, detail, tone = "slate" }) {
  const barClass = tone === "orange" ? "bg-orange-300" : "bg-slate-300";

  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-10 w-1 rounded-full ${barClass}`} />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
          <p className="mt-1 text-sm font-black text-white">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function PerformanceLane({ label, value, detail, progress, tone = "slate" }) {
  const safeProgress = Math.max(6, Math.min(Number(progress || 0), 100));
  const gradient =
    tone === "orange"
      ? "linear-gradient(90deg, #F28C28, rgba(255,255,255,0.88))"
      : "linear-gradient(90deg, #cbd5e1, rgba(255,255,255,0.9))";

  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
          <p className="mt-2 text-base font-black text-white">{value}</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full"
          style={{ width: `${safeProgress}%`, background: gradient }}
        />
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function SummaryBadge({ label, value, detail }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function ChartEmptyState({ label, title, detail, compact = false }) {
  return (
    <div className={`flex h-full items-center justify-center rounded-[22px] border border-dashed border-white/10 bg-black/10 px-6 text-center ${compact ? "py-6" : "py-8"}`}>
      <div className="max-w-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
        <p className="mt-3 text-lg font-black text-white">{title}</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
      </div>
    </div>
  );
}
