import {
  Bar,
  BarChart,
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

const PALETTE = {
  emerald: {
    primary: "#102A43",
    secondary: "#F28C28",
    tertiary: "#DC2626",
    panel: "from-[#0b1525] via-[#102A43] to-[#111827]",
    glow: "rgba(242,140,40,0.18)",
    chip: "text-orange-200",
  },
  amber: {
    primary: "#F28C28",
    secondary: "#102A43",
    tertiary: "#DC2626",
    panel: "from-[#1f2937] via-[#102A43] to-[#0f172a]",
    glow: "rgba(242,140,40,0.22)",
    chip: "text-orange-200",
  },
};

const DONUT_COLORS = ["#102A43", "#F28C28", "#DC2626", "#1C4268", "#94A3B8"];

const money = (value) => `Tsh ${Number(value || 0).toLocaleString()}`;

const compact = (value) =>
  new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));

const percent = (value) => `${Number(value || 0).toFixed(0)}%`;

const sum = (items, key) => items.reduce((total, item) => total + Number(item[key] || 0), 0);

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  const total = payload.reduce((running, entry) => running + Number(entry.value || 0), 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 text-white shadow-[0_18px_35px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{money(total)}</p>
      <div className="mt-3 space-y-2">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-semibold text-white">{money(entry.value)}</span>
          </div>
        ))}
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
        {money(entry.value)}
      </p>
      <p className="mt-1 text-xs text-slate-400">value currently sitting in this segment</p>
    </div>
  );
}

export default function PayoutTrendCharts({ trendData = [], statusData = [], tone = "emerald" }) {
  const theme = PALETTE[tone] || PALETTE.emerald;
  const normalizedTrend = trendData.map((entry) => ({
    ...entry,
    paid: Number(entry.paid || 0),
    pending: Number(entry.pending || 0),
    onHold: Number(entry.onHold || 0),
    total: Number(entry.paid || 0) + Number(entry.pending || 0) + Number(entry.onHold || 0),
  }));
  const normalizedMix = statusData.map((entry, index) => ({
    ...entry,
    value: Number(entry.value || 0),
    fill: DONUT_COLORS[index % DONUT_COLORS.length],
  }));
  const hasTrendData = normalizedTrend.length > 0;
  const hasMixData = normalizedMix.length > 0;

  const totalPaid = sum(normalizedTrend, "paid");
  const totalPending = sum(normalizedTrend, "pending");
  const totalOnHold = sum(normalizedTrend, "onHold");
  const totalExposure = totalPaid + totalPending + totalOnHold;
  const releaseRate = totalExposure ? (totalPaid / totalExposure) * 100 : 0;
  const blockedShare = totalExposure ? (totalOnHold / totalExposure) * 100 : 0;
  const pendingShare = totalExposure ? (totalPending / totalExposure) * 100 : 0;
  const avgExposure = normalizedTrend.length ? sum(normalizedTrend, "total") / normalizedTrend.length : 0;
  const totalMix = sum(normalizedMix, "value");
  const topMix = normalizedMix
    .slice()
    .sort((left, right) => right.value - left.value)[0] || null;
  const latestPoint =
    normalizedTrend[normalizedTrend.length - 1] || { label: "Latest period", paid: 0, pending: 0, onHold: 0, total: 0 };
  const latestReleaseRate = latestPoint.total ? (latestPoint.paid / latestPoint.total) * 100 : 0;
  const latestQueuePressure = latestPoint.total
    ? ((latestPoint.pending + latestPoint.onHold) / latestPoint.total) * 100
    : 0;
  const latestHoldPressure = latestPoint.total ? (latestPoint.onHold / latestPoint.total) * 100 : 0;

  return (
    <section className="grid gap-5 xl:grid-cols-[1.28fr_0.78fr]">
      <motion.article
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        whileHover={{ y: -4 }}
        className={`relative min-w-0 overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br ${theme.panel} p-5 text-white shadow-[0_28px_65px_rgba(15,23,42,0.28)] md:p-6`}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at top left, ${theme.glow}, transparent 30%), radial-gradient(circle at bottom right, rgba(148,163,184,0.10), transparent 30%)`,
          }}
        />

        <div className="relative">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${theme.chip}`}>
                  Vendor Payouts
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Recent periods
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Paid and outstanding
                </span>
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
                A clearer payout view of what is paid and what is still waiting
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                See paid value, outstanding value, and held amounts in a cleaner business-focused layout.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm lg:w-[260px]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Quick Read
              </p>
              <div className="mt-3 grid gap-3">
                <MetricRow
                  label="Payout rate"
                  value={percent(releaseRate)}
                  note="share already paid"
                  positive
                />
                <MetricRow
                  label="Still pending"
                  value={percent(pendingShare)}
                  note="value still moving through the queue"
                  positive={pendingShare < 50}
                />
                <MetricRow
                  label="On hold"
                  value={percent(blockedShare)}
                  note="value currently held back"
                  positive={blockedShare < 25}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Paid Out" value={money(totalPaid)} accent="text-white" />
            <MetricCard label="Pending" value={money(totalPending)} accent="text-orange-300" />
            <MetricCard label="On Hold" value={money(totalOnHold)} accent="text-red-300" />
            <MetricCard label="Average per Period" value={money(avgExposure)} accent="text-slate-100" />
          </div>

          <div className="mt-6 rounded-[26px] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <LegendPill label="Paid Out" swatch="bg-[#102A43]" />
                <LegendPill label="Pending" swatch="bg-[#F28C28]" />
                <LegendPill label="On Hold" swatch="bg-[#DC2626]" />
                <LegendPill label="Average" swatch="bg-white/60" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <InfoPill label="Latest period" value={latestPoint.label || "Current"} tone="slate" />
                <InfoPill label="Paid Out" value={money(latestPoint.paid)} tone="navy" />
                <InfoPill label="Still waiting" value={money(latestPoint.pending + latestPoint.onHold)} tone="orange" />
              </div>
            </div>

            <div className="mt-4 h-[280px] sm:h-[320px] lg:h-[340px]">
              {hasTrendData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={normalizedTrend} barCategoryGap={24} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`payoutPaid-${tone}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={theme.primary} stopOpacity={1} />
                        <stop offset="100%" stopColor={theme.primary} stopOpacity={0.72} />
                      </linearGradient>
                      <linearGradient id={`payoutPending-${tone}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={theme.secondary} stopOpacity={1} />
                        <stop offset="100%" stopColor={theme.secondary} stopOpacity={0.74} />
                      </linearGradient>
                      <linearGradient id={`payoutHold-${tone}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={theme.tertiary} stopOpacity={1} />
                        <stop offset="100%" stopColor={theme.tertiary} stopOpacity={0.76} />
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
                      tickLine={false}
                      axisLine={false}
                      width={60}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      tickFormatter={(value) => compact(value)}
                    />
                    {avgExposure > 0 ? (
                      <ReferenceLine
                        y={avgExposure}
                        stroke="rgba(255,255,255,0.26)"
                        strokeDasharray="6 6"
                      />
                    ) : null}
                    <Tooltip content={<TrendTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar
                      dataKey="paid"
                      name="Released"
                      fill={`url(#payoutPaid-${tone})`}
                      stackId="settlement"
                      radius={[12, 12, 0, 0]}
                    />
                    <Bar dataKey="pending" name="Pending" fill={`url(#payoutPending-${tone})`} stackId="settlement" />
                    <Bar dataKey="onHold" name="On Hold" fill={`url(#payoutHold-${tone})`} stackId="settlement" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyState
                  label="Payout trend"
                  title="Waiting for more payout history"
                  detail="As payout records build across more periods, this chart will show paid value, pending amounts, and held value automatically."
                />
              )}
            </div>

            <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-4">
              <SnapshotCard
                label="Total Value"
                value={money(totalExposure)}
                detail="paid out + pending + on hold"
              />
              <SnapshotCard
                label="Payout Rate"
                value={percent(releaseRate)}
                detail="share already paid"
              />
              <SnapshotCard
                label="Pending Share"
                value={percent(pendingShare)}
                detail="value still waiting"
              />
              <SnapshotCard
                label="Hold Share"
                value={percent(blockedShare)}
                detail="value currently held back"
              />
            </div>

            <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-2 xl:grid-cols-4">
              <PerformanceLane
                label="Latest payout pace"
                value={percent(latestReleaseRate)}
                detail="paid value in the latest period"
                progress={latestReleaseRate}
                tone="orange"
              />
              <PerformanceLane
                label="Latest pending share"
                value={percent(latestQueuePressure)}
                detail="pending plus held value in the latest period"
                progress={latestQueuePressure}
                tone="slate"
              />
              <PerformanceLane
                label="Latest hold share"
                value={percent(latestHoldPressure)}
                detail="held value in the latest period"
                progress={latestHoldPressure}
                tone="red"
              />
              <PerformanceLane
                label="Overall payout health"
                value={percent(releaseRate)}
                detail="overall payout performance across the full history"
                progress={releaseRate}
                tone="orange"
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
        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(242,140,40,0.12),transparent_68%)]" />

        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">Payout Breakdown</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
            See where payout value is sitting right now
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            A quick top summary, exact value shares in the middle, and a short business takeaway below.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SummaryBadge
              label="Total Value"
              value={money(totalMix)}
              detail={`${normalizedMix.length} active payout buckets in the current mix`}
            />
            <SummaryBadge
              label="Leading Segment"
              value={topMix?.name || "No active segment"}
              detail={topMix ? `${money(topMix.value)} is the largest amount right now` : "Waiting for payout mix data"}
            />
          </div>

          <div className="mt-6 rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] p-4 text-white">
            <div className="relative h-[190px] sm:h-[220px]">
              {hasMixData ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip content={<MixTooltip />} />
                      <Pie
                        data={normalizedMix}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={88}
                        paddingAngle={3}
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth={2}
                      >
                        {normalizedMix.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full border border-white/10 bg-slate-950/75 px-5 py-4 text-center shadow-[0_16px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Total
                      </p>
                      <p className="mt-2 text-2xl font-black text-white">{money(totalMix)}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {topMix ? `${topMix.name} leads` : "No payout mix yet"}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <ChartEmptyState
                    label="Payout breakdown"
                    title="Waiting for payout segments to fill up"
                    detail="As paid, pending, ready-queue, and held values build up, this panel will show where the money is sitting."
                    compact
                  />
                )}
            </div>

            <div className="mt-4 space-y-3">
              {normalizedMix.length ? (
                normalizedMix.map((entry) => {
                  const share = totalMix ? Math.round((entry.value / totalMix) * 100) : 0;
                  return (
                    <div
                      key={entry.name}
                      className="rounded-[20px] border border-white/10 bg-white/[0.05] px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.fill }} />
                          <div>
                            <p className="text-sm font-semibold text-white">{entry.name}</p>
                            <p className="text-xs text-slate-400">{share}% of total value</p>
                          </div>
                        </div>
                        <p className="text-sm font-black text-white">{money(entry.value)}</p>
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
                <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400">
                  Payout mix will show here once settlement records and ready-queue values become available.
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 border-t border-white/10 pt-4">
              <InsightRail
                label="Largest Segment"
                value={topMix?.name || "No active segment"}
                detail={topMix ? `${money(topMix.value)} is the largest amount right now` : "Waiting for more payout data"}
                tone="orange"
              />
              <InsightRail
                label="Payout Health"
                value={releaseRate >= 70 ? "Payouts are moving well" : "Payouts need attention"}
                detail={
                  releaseRate >= 70
                    ? "Most payout value is being released without major delay"
                    : "A large share is still pending or held, so it needs closer follow-up"
                }
                tone={releaseRate >= 70 ? "slate" : "red"}
              />
            </div>
          </div>
        </div>
      </motion.article>
    </section>
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
    navy: "border-[#102A43]/20 bg-[#102A43]/18 text-white",
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
  const barClass =
    tone === "orange" ? "bg-orange-300" : tone === "red" ? "bg-red-300" : "bg-slate-300";

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
      : tone === "red"
        ? "linear-gradient(90deg, #DC2626, rgba(255,255,255,0.88))"
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
