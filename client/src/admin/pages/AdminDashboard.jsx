import { Suspense, lazy, useEffect, useState } from "react";
import axios from "../../utils/axios";
import {
  FaBell,
  FaMoneyBillWave,
  FaShoppingBag,
  FaTruck,
  FaUsers,
} from "react-icons/fa";

import { extractOne } from "../../utils/apiShape";
import { useToast } from "../../hooks/useToast";
import { TableSkeleton } from "../../components/Skeleton";

const REFRESH_INTERVAL = 20000;

const DashboardCharts = lazy(() => import("../components/DashboardCharts"));

export default function AdminDashboard() {
  const toast = useToast();
  const [stats, setStats] = useState(null);

  const fetchDashboard = async () => {
    try {
      const { data } = await axios.get("/admin/dashboard");
      const payload = extractOne(data);
      setStats(payload);
    } catch (err) {
      console.error(err);
      toast.error("Unable to load marketplace overview");
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return <TableSkeleton rows={5} />;
  }

  const pieData = (stats.orderStatusStats || []).map((item) => ({
    name: formatOrderStage(item._id),
    value: item.count,
  }));

  const weeklyMomentum = stats.salesInsights?.weeklyMomentum || {};
  const monthlyLeaderboard = stats.salesInsights?.monthlyLeaderboard || [];
  const inventorySignals = stats.salesInsights?.inventorySignals || {};
  const vendorGrowthLeaderboard = stats.salesInsights?.vendorGrowthLeaderboard || [];
  const customerInsights = stats.salesInsights?.customerInsights || {};
  const orderValueInsights = stats.salesInsights?.orderValueInsights || {};
  const paymentInsights = stats.salesInsights?.paymentInsights || {};
  const operationsInsights = stats.salesInsights?.operationsInsights || {};

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="overflow-hidden rounded-[28px] border border-emerald-100 bg-[linear-gradient(135deg,#f0fdf4_0%,#ffffff_42%,#fff7ed_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-600">Marketplace Snapshot</p>
        <h1 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">Commerce Pulse</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sales, shoppers, sellers, deliveries, and store health in one clear marketplace view.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        <KPI
          label="Sales This Month"
          value={`Tsh ${(stats.kpis?.monthlyRevenue || 0).toLocaleString()}`}
          icon={FaMoneyBillWave}
          tone="emerald"
        />
        <KPI
          label="Orders So Far"
          value={stats.kpis?.totalOrders || 0}
          icon={FaShoppingBag}
          tone="sky"
        />
        <KPI
          label="Orders to Prepare"
          value={stats.kpis?.pendingOrders || 0}
          icon={FaTruck}
          tone="amber"
        />
        <KPI
          label="People on the Platform"
          value={stats.kpis?.totalUsers || 0}
          icon={FaUsers}
          tone="rose"
        />
      </div>

      <Suspense fallback={<TableSkeleton rows={3} />}>
        <DashboardCharts revenueByDay={stats.revenueByDay || []} pieData={pieData} />
      </Suspense>

      <section className="rounded-[28px] border border-white/90 bg-white/90 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">What shoppers are buying</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Marketplace demand at a glance</h2>
            <p className="text-sm text-slate-500">See what is selling well, how your assortment is growing, and where demand is strongest.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HealthCard
            label="Shopper Conversion"
            value={`${Number(stats.kpis?.conversionRate || 0).toLocaleString()}%`}
            suffix="shoppers turning into orders"
            tone="emerald"
          />
          <HealthCard
            label="Live Listings"
            value={stats.kpis?.totalProducts || 0}
            suffix="products ready to sell"
            tone="sky"
          />
          <HealthCard
            label="Top Item by Units"
            value={(stats.topProducts?.[0]?.soldQty || 0).toLocaleString()}
            suffix={stats.topProducts?.[0]?.name || "No sales yet"}
            tone="amber"
          />
          <HealthCard
            label="Top Item by Sales"
            value={`Tsh ${Number(stats.topProducts?.[0]?.revenue || 0).toLocaleString()}`}
            suffix="best revenue maker"
            tone="violet"
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">This Week in Sales</p>
            <h3 className="mt-1 text-base font-black text-slate-900">Paid sales compared with last week</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">This Week</p>
                <p className="mt-2 text-2xl font-black text-emerald-700">Tsh {Number(weeklyMomentum.currentWeekRevenue || 0).toLocaleString()}</p>
                <p className="mt-1 text-xs text-slate-500">{weeklyMomentum.currentWeekOrders || 0} paid orders</p>
              </div>
              <div className="rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Last Week</p>
                <p className="mt-2 text-2xl font-black text-sky-700">Tsh {Number(weeklyMomentum.previousWeekRevenue || 0).toLocaleString()}</p>
                <p className="mt-1 text-xs text-slate-500">{weeklyMomentum.previousWeekOrders || 0} paid orders</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Sales Growth</p>
                <p className="mt-2 text-2xl font-black text-emerald-800">{Number(weeklyMomentum.growthRate || 0).toLocaleString()}%</p>
                <p className="mt-1 text-xs text-emerald-700/80">Compared with the previous 7 days.</p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Daily Sales Pace</p>
                <p className="mt-2 text-2xl font-black text-violet-800">Tsh {Number(weeklyMomentum.averageDailyRevenue || 0).toLocaleString()}</p>
                <p className="mt-1 text-xs text-violet-700/80">Average paid sales generated each day this week.</p>
              </div>
            </div>
          </article>

          <article className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Best Sellers This Month</p>
            <h3 className="mt-1 text-base font-black text-slate-900">Products leading sales this month</h3>
            <div className="mt-4 space-y-3">
              {monthlyLeaderboard.length ? (
                monthlyLeaderboard.map((product, index) => (
                  <div key={product.productId || `${product.name}-${index}`} className="rounded-2xl border border-white bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">#{index + 1} {product.name}</p>
                        <p className="text-xs text-slate-500">{Number(product.soldQty || 0).toLocaleString()} units • {product.orders || 0} paid orders</p>
                      </div>
                      <p className="text-sm font-black text-amber-700">Tsh {Number(product.revenue || 0).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <PageHint message="Monthly product leaders will appear here once this month starts collecting paid sales." />
              )}
            </div>
          </article>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <article className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Restock Soon</p>
            <h3 className="mt-1 text-base font-black text-slate-900">Products getting close to selling out</h3>
            <div className="mt-4 space-y-3">
              {(inventorySignals.lowStockProducts || []).length ? (
                inventorySignals.lowStockProducts.map((product, index) => (
                  <div key={product.id || `${product.name}-${index}`} className="rounded-2xl border border-white bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">#{index + 1} {product.name}</p>
                        <p className="text-xs text-slate-500">{product.vendorName}{product.storeSlug ? ` • Store: ${product.storeSlug}` : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-rose-700">{Number(product.stock || 0).toLocaleString()} in stock</p>
                        <p className="text-xs text-slate-500">{Number(product.soldQty || 0).toLocaleString()} sold</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <PageHint message="Restock signals will appear here when popular products start getting close to selling out." />
              )}
            </div>
          </article>

          <article className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Needs a Sales Boost</p>
            <h3 className="mt-1 text-base font-black text-slate-900">Items that may need fresh pricing, photos, or promotion</h3>
            <div className="mt-4 space-y-3">
              {(inventorySignals.slowMovers || []).length ? (
                inventorySignals.slowMovers.map((product, index) => (
                  <div key={product.id || `${product.name}-${index}`} className="rounded-2xl border border-white bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">#{index + 1} {product.name}</p>
                        <p className="text-xs text-slate-500">{product.vendorName}{product.storeSlug ? ` • Store: ${product.storeSlug}` : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-amber-700">{Number(product.soldQty || 0).toLocaleString()} sold</p>
                        <p className="text-xs text-slate-500">Tsh {Number(product.revenue || 0).toLocaleString()} revenue</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <PageHint message="Products that need a stronger push will appear here once listings build more sales history." />
              )}
            </div>
          </article>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <article className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Top Products</p>
            <h3 className="mt-1 text-base font-black text-slate-900">Current sales leaders</h3>
            <div className="mt-4 space-y-3">
              {(stats.topProducts || []).length ? (
                stats.topProducts.map((product, index) => (
                  <div key={`${product.name}-${index}`} className="flex items-center justify-between rounded-2xl border border-white bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">#{index + 1} {product.name}</p>
                      <p className="text-xs text-slate-500">{Number(product.soldQty || 0).toLocaleString()} units sold</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-700">Tsh {Number(product.revenue || 0).toLocaleString()}</p>
                      <p className="text-xs text-slate-500">sales value</p>
                    </div>
                  </div>
                ))
              ) : (
                <PageHint message="Top-selling products will appear here once orders start coming in." />
              )}
            </div>
          </article>

          <article className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Quick Commerce Signals</p>
            <h3 className="mt-1 text-base font-black text-slate-900">Fast numbers for everyday decisions</h3>
            <div className="mt-4 space-y-3">
              {[
                {
                  label: "Shopper to order flow",
                  value: `${Number(stats.kpis?.conversionRate || 0).toLocaleString()}%`,
                  detail: "Shows how strongly browsing shoppers are turning into buyers.",
                  tone: "text-emerald-700",
                },
                {
                  label: "Paid sales so far",
                  value: `Tsh ${Number(stats.kpis?.totalRevenue || 0).toLocaleString()}`,
                  detail: "Confirmed paid sales across the marketplace so far.",
                  tone: "text-sky-700",
                },
                {
                  label: "Live products",
                  value: Number(stats.kpis?.totalProducts || 0).toLocaleString(),
                  detail: "Useful for tracking assortment growth and shopper choice.",
                  tone: "text-violet-700",
                },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                  <p className={`mt-2 text-2xl font-black ${item.tone}`}>{item.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/90 bg-white/90 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Returning Shoppers</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Who is buying again</h2>
            <p className="text-sm text-slate-500">Track loyal shoppers, new customer pull, and repeat order value.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <HealthCard
            label="Active Buyers"
            value={customerInsights.totalBuyingCustomers || 0}
            suffix="shoppers with at least one order"
            tone="emerald"
          />
          <HealthCard
            label="Repeat Shoppers"
            value={customerInsights.repeatBuyers || 0}
            suffix="customers with 2+ orders"
            tone="sky"
          />
          <HealthCard
            label="Repeat Share"
            value={`${Number(customerInsights.repeatBuyerRate || 0).toLocaleString()}%`}
            suffix="share of buying customers"
            tone="amber"
          />
          <HealthCard
            label="New Shoppers"
            value={customerInsights.newCustomersThisMonth || 0}
            suffix="first-time buyers this month"
            tone="violet"
          />
          <HealthCard
            label="Returning Shoppers"
            value={customerInsights.returningCustomersThisMonth || 0}
            suffix="existing buyers active this month"
            tone="rose"
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
          <article className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Most Loyal Shoppers</p>
            <h3 className="mt-1 text-base font-black text-slate-900">Customers coming back most often</h3>
            <div className="mt-4 space-y-3">
              {(customerInsights.topRepeatBuyers || []).length ? (
                customerInsights.topRepeatBuyers.map((customer, index) => (
                  <div key={customer.id || `${customer.name}-${index}`} className="rounded-2xl border border-white bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">#{index + 1} {customer.name}</p>
                        <p className="text-xs text-slate-500">{customer.email || "No email available"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-emerald-700">{customer.totalOrders || 0} orders</p>
                        <p className="text-xs text-slate-500">Tsh {Number(customer.totalPaidRevenue || 0).toLocaleString()} lifetime paid</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <PageHint message="Your most loyal shoppers will appear here once repeat orders begin to build." />
              )}
            </div>
          </article>

          <article className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">New vs Returning Sales</p>
            <h3 className="mt-1 text-base font-black text-slate-900">This month's sales mix by shopper type</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">New Shoppers</p>
                <p className="mt-2 text-2xl font-black text-violet-700">Tsh {Number(customerInsights.newCustomerRevenue || 0).toLocaleString()}</p>
                <p className="mt-1 text-xs text-slate-500">Sales from first-time shoppers this month.</p>
              </div>
              <div className="rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Returning Shoppers</p>
                <p className="mt-2 text-2xl font-black text-emerald-700">Tsh {Number(customerInsights.returningCustomerRevenue || 0).toLocaleString()}</p>
                <p className="mt-1 text-xs text-slate-500">Sales from returning shoppers this month.</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {[
                {
                  label: "Loyalty strength",
                  value: `${Number(customerInsights.repeatBuyerRate || 0).toLocaleString()}%`,
                  detail: "How much of your buying base has returned for another order.",
                  tone: "text-emerald-700",
                },
                {
                  label: "New shopper pull",
                  value: customerInsights.newCustomersThisMonth || 0,
                  detail: "How many first-time shoppers entered the marketplace this month.",
                  tone: "text-violet-700",
                },
                {
                  label: "Returning shopper activity",
                  value: customerInsights.returningCustomersThisMonth || 0,
                  detail: "How many familiar shoppers came back to buy this month.",
                  tone: "text-sky-700",
                },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                  <p className={`mt-2 text-2xl font-black ${item.tone}`}>{item.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/90 bg-white/90 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Basket Value & Payments</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">How checkout performance is shaping sales</h2>
            <p className="text-sm text-slate-500">Track basket size, top delivery areas, and how well payments are closing.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <HealthCard
            label="Average Basket"
            value={`Tsh ${Number(orderValueInsights.averageOrderValue || 0).toLocaleString()}`}
            suffix="paid orders overall"
            tone="emerald"
          />
          <HealthCard
            label="This Month's Basket"
            value={`Tsh ${Number(orderValueInsights.monthlyAverageOrderValue || 0).toLocaleString()}`}
            suffix="paid orders this month"
            tone="sky"
          />
          <HealthCard
            label="Payment Success"
            value={`${Number(paymentInsights.successRate || 0).toLocaleString()}%`}
            suffix="completed payment requests"
            tone="amber"
          />
          <HealthCard
            label="Payments Completed"
            value={paymentInsights.completed || 0}
            suffix="successful payment confirmations"
            tone="violet"
          />
          <HealthCard
            label="Payments to Follow Up"
            value={(paymentInsights.failed || 0) + (paymentInsights.pending || 0)}
            suffix="pending or failed attempts"
            tone="rose"
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <article className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Top Delivery Areas</p>
            <h3 className="mt-1 text-base font-black text-slate-900">Where marketplace demand is strongest</h3>
            <div className="mt-4 space-y-3">
              {(orderValueInsights.topDeliveryAreas || []).length ? (
                orderValueInsights.topDeliveryAreas.map((area, index) => (
                  <div key={area.label || index} className="rounded-2xl border border-white bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">#{index + 1} {area.label}</p>
                        <p className="text-xs text-slate-500">{area.orders || 0} orders</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-emerald-700">Tsh {Number(area.paidRevenue || 0).toLocaleString()}</p>
                        <p className="text-xs text-slate-500">paid revenue</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <PageHint message="Top delivery areas will appear here once shopper demand builds stronger location history." />
              )}
            </div>
          </article>

          <article className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Payment Pulse</p>
            <h3 className="mt-1 text-base font-black text-slate-900">Recent payment results</h3>
            <div className="mt-4 space-y-3">
              {(paymentInsights.trend || []).length ? (
                paymentInsights.trend.map((day) => (
                  <div key={day.date} className="rounded-2xl border border-white bg-white px-4 py-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{day.date}</p>
                        <p className="text-xs text-slate-500">Daily payment snapshot</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-right">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Paid</p>
                          <p className="text-sm font-black text-emerald-700">{day.completed || 0}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Failed</p>
                          <p className="text-sm font-black text-rose-700">{day.failed || 0}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pending</p>
                          <p className="text-sm font-black text-amber-700">{day.pending || 0}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <PageHint message="Payment results will appear here once the marketplace collects a few days of payment activity." />
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/90 bg-white/90 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Delivery Performance</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">How quickly orders are reaching shoppers</h2>
            <p className="text-sm text-slate-500">Track delivery speed, rider activity, and where service friction is appearing.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <HealthCard
            label="Average Delivery Time"
            value={operationsInsights.averageDeliveryHours !== null && operationsInsights.averageDeliveryHours !== undefined ? `${Number(operationsInsights.averageDeliveryHours || 0).toLocaleString()} hrs` : "No data yet"}
            suffix="from order creation to delivery"
            tone="emerald"
          />
          <HealthCard
            label="Best Delivery Time"
            value={operationsInsights.fastestDeliveryHours !== null && operationsInsights.fastestDeliveryHours !== undefined ? `${Number(operationsInsights.fastestDeliveryHours || 0).toLocaleString()} hrs` : "No data yet"}
            suffix="best recent delivery speed"
            tone="sky"
          />
          <HealthCard
            label="Cancellation Rate"
            value={`${Number(operationsInsights.cancellationRate || 0).toLocaleString()}%`}
            suffix={`${operationsInsights.cancelledOrders || 0} cancelled orders`}
            tone="amber"
          />
          <HealthCard
            label="Refund Rate"
            value={`${Number(operationsInsights.refundRate || 0).toLocaleString()}%`}
            suffix={`${operationsInsights.refundedOrders || 0} refunded orders`}
            tone="violet"
          />
          <HealthCard
            label="Longest Delivery Time"
            value={operationsInsights.slowestDeliveryHours !== null && operationsInsights.slowestDeliveryHours !== undefined ? `${Number(operationsInsights.slowestDeliveryHours || 0).toLocaleString()} hrs` : "No data yet"}
            suffix="longest recent delivery time"
            tone="rose"
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <article className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Delivery Team Load</p>
            <h3 className="mt-1 text-base font-black text-slate-900">Who is handling today's delivery work</h3>
            <div className="mt-4 space-y-3">
              {(operationsInsights.riderWorkload || []).length ? (
                operationsInsights.riderWorkload.map((rider, index) => (
                  <div key={rider.id || `${rider.name}-${index}`} className="rounded-2xl border border-white bg-white px-4 py-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">#{index + 1} {rider.name}</p>
                        <p className="text-xs text-slate-500">{rider.available ? "Available" : "Busy"} • {rider.isActive ? "Active" : "Inactive"}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-right">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Live</p>
                          <p className="text-sm font-black text-amber-700">{rider.activeAssignments || 0}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Delivered</p>
                          <p className="text-sm font-black text-emerald-700">{rider.deliveredCount || 0}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Assigned</p>
                          <p className="text-sm font-black text-sky-700">{rider.currentOrders || 0}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <PageHint message="Delivery team activity will appear here once riders are assigned to active orders." />
              )}
            </div>
          </article>

          <article className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Service Exceptions</p>
            <h3 className="mt-1 text-base font-black text-slate-900">Recent cancelled and refunded orders</h3>
            <div className="mt-4 space-y-3">
              {(operationsInsights.cancelRefundTrend || []).length ? (
                operationsInsights.cancelRefundTrend.map((day) => (
                  <div key={day.date} className="rounded-2xl border border-white bg-white px-4 py-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{day.date}</p>
                        <p className="text-xs text-slate-500">Daily service exceptions snapshot</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-right">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Cancelled</p>
                          <p className="text-sm font-black text-amber-700">{day.cancelled || 0}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Refunded</p>
                          <p className="text-sm font-black text-rose-700">{day.refunded || 0}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <PageHint message="Cancelled and refunded order trends will appear here once the marketplace collects recent service exceptions." />
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/90 bg-white/90 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Seller Growth</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Stores gaining momentum this month</h2>
            <p className="text-sm text-slate-500">See which sellers are growing fastest and where restock pressure is building.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HealthCard
            label="Growing Stores"
            value={(vendorGrowthLeaderboard || []).length}
            suffix="stores with recent revenue activity"
            tone="emerald"
          />
          <HealthCard
            label="Restock Alerts"
            value={inventorySignals.lowStockCount || 0}
            suffix="approved products at 5 or less"
            tone="rose"
          />
          <HealthCard
            label="Fastest Growth"
            value={`${Number(vendorGrowthLeaderboard?.[0]?.growthRate || 0).toLocaleString()}%`}
            suffix={vendorGrowthLeaderboard?.[0]?.name || "No growth data yet"}
            tone="sky"
          />
          <HealthCard
            label="Leading Store Sales"
            value={`Tsh ${Number(vendorGrowthLeaderboard?.[0]?.currentRevenue || 0).toLocaleString()}`}
            suffix="top store this month"
            tone="violet"
          />
        </div>

        <div className="mt-5 space-y-3">
          {vendorGrowthLeaderboard.length ? (
            vendorGrowthLeaderboard.map((vendor, index) => (
              <div key={vendor.id || vendor.storeSlug || vendor.name} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">#{index + 1} {vendor.name}</p>
                  <p className="text-xs text-slate-500">Store: {vendor.storeSlug} • {vendor.currentOrders || 0} orders this month</p>
                </div>
                <div className="grid gap-3 text-right sm:grid-cols-3 sm:gap-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">This Month</p>
                    <p className="text-sm font-black text-emerald-700">Tsh {Number(vendor.currentRevenue || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Last Month</p>
                    <p className="text-sm font-black text-slate-700">Tsh {Number(vendor.previousRevenue || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Sales Growth</p>
                    <p className="text-sm font-black text-sky-700">{Number(vendor.growthRate || 0).toLocaleString()}%</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <PageHint message="Seller growth ranking will appear once stores build sales across more than one month." />
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/90 bg-white/90 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Seller Payouts</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Store earnings ready for payout</h2>
            <p className="text-sm text-slate-500">Follow paid out value, money still waiting, and stores that need payout follow-up.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <HealthCard
            label="Paid Out"
            value={`Tsh ${(stats.payouts?.totalPaid || 0).toLocaleString()}`}
            tone="emerald"
          />
          <HealthCard
            label="Waiting to Pay Out"
            value={`Tsh ${(stats.payouts?.pendingAmount || 0).toLocaleString()}`}
            tone="sky"
          />
          <HealthCard
            label="On Hold"
            value={`Tsh ${(stats.payouts?.onHoldAmount || 0).toLocaleString()}`}
            tone="amber"
          />
          <HealthCard
            label="Average Payout Speed"
            value={stats.payouts?.settlementPerformance?.averageDays !== null && stats.payouts?.settlementPerformance?.averageDays !== undefined ? `${stats.payouts.settlementPerformance.averageDays} days` : "No data yet"}
            suffix={`${stats.payouts?.totalRecords || 0} payout records`}
            tone="violet"
          />
          <HealthCard
            label="Funds Needing Attention"
            value={`${Number(stats.payouts?.exposureRate || 0).toLocaleString()}%`}
            suffix="share still waiting"
            tone="rose"
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Top Sellers by Payout</p>
            <h3 className="mt-1 text-base font-black text-slate-900">Stores with the largest payout totals</h3>
            <div className="mt-4 space-y-3">
              {(stats.payouts?.topVendors || []).length ? (
                stats.payouts.topVendors.map((vendor, index) => (
                  <div key={vendor.id || vendor.storeSlug || vendor.name} className="flex items-center justify-between rounded-2xl border border-white bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">#{index + 1} {vendor.name}</p>
                      <p className="text-xs text-slate-500">Store: {vendor.storeSlug} • {vendor.records} payout records</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-700">Tsh {Number(vendor.total || 0).toLocaleString()}</p>
                      <p className="text-xs text-slate-500">Paid Tsh {Number(vendor.paid || 0).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <PageHint message="Seller payout ranking will appear once payout records are available." />
              )}
            </div>
          </article>

          <article className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Payout Speed</p>
            <h3 className="mt-1 text-base font-black text-slate-900">How quickly seller payouts are completed</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {[
                { label: "Fastest", value: stats.payouts?.settlementPerformance?.fastestDays !== null && stats.payouts?.settlementPerformance?.fastestDays !== undefined ? `${stats.payouts.settlementPerformance.fastestDays} days` : "No data yet", tone: "text-emerald-700" },
                { label: "Slowest", value: stats.payouts?.settlementPerformance?.slowestDays !== null && stats.payouts?.settlementPerformance?.slowestDays !== undefined ? `${stats.payouts.settlementPerformance.slowestDays} days` : "No data yet", tone: "text-rose-700" },
                { label: "Paid", value: stats.payouts?.settlementPerformance?.settledCount || 0, tone: "text-violet-700" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                  <p className={`mt-2 text-2xl font-black ${item.tone}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="mt-4 rounded-[24px] border border-rose-100 bg-[linear-gradient(135deg,#fff7ed_0%,#fff1f2_100%)] p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-400">Needs Attention</p>
              <h3 className="mt-1 text-base font-black text-slate-900">Stores waiting longest for payout action</h3>
              <p className="text-sm text-slate-500">These stores currently hold the largest payout value that still needs follow-up.</p>
            </div>
            <p className="text-sm font-semibold text-rose-600">Attention share: {Number(stats.payouts?.exposureRate || 0).toLocaleString()}%</p>
          </div>

          <div className="mt-4 space-y-3">
            {(stats.payouts?.watchlistVendors || []).length ? (
              stats.payouts.watchlistVendors.map((vendor, index) => (
                <div key={vendor.id || vendor.storeSlug || vendor.name} className="flex flex-col gap-3 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">#{index + 1} {vendor.name}</p>
                    <p className="text-xs text-slate-500">Store: {vendor.storeSlug} • {vendor.records} payout records</p>
                  </div>
                  <div className="grid gap-2 text-right sm:grid-cols-3 sm:gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pending</p>
                      <p className="text-sm font-black text-sky-700">Tsh {Number(vendor.pending || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">On Hold</p>
                      <p className="text-sm font-black text-amber-700">Tsh {Number(vendor.onHold || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">At Risk</p>
                      <p className="text-sm font-black text-rose-700">Tsh {Number(vendor.atRisk || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <PageHint message="No store payout pressure is building right now. This list will fill automatically when seller payouts start waiting." />
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/90 bg-white/90 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700">
            <FaBell size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Marketplace Updates</h2>
            <p className="text-sm text-slate-500">
              Keep an eye on new updates, live shopper alerts, and recent marketplace activity.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HealthCard
            label="New Team Updates"
            value={stats.notifications?.unreadAdminNotifications || 0}
            tone="emerald"
          />
          <HealthCard
            label="New Shopper Updates"
            value={stats.notifications?.unreadCustomerNotifications || 0}
            tone="sky"
          />
          <HealthCard
            label="Recent Alerts"
            value={stats.notifications?.recentOutboxEvents || 0}
            suffix="last hour"
            tone="amber"
          />
          <HealthCard
            label="Live Viewers"
            value={stats.notifications?.activeStreamClients || 0}
            suffix={`${stats.notifications?.activeAdminStreamClients || 0} admin / ${
              stats.notifications?.activeCustomerStreamClients || 0
            } customers`}
            tone="violet"
          />
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-[linear-gradient(135deg,#f8fafc_0%,#fff7ed_100%)] p-4 text-sm text-slate-600">
          <p>
            <span className="font-semibold text-slate-900">Live feed:</span>{" "}
            {stats.notifications?.relayInstanceId || "N/A"}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-900">Latest update:</span>{" "}
            {stats.notifications?.latestOutboxEventAt
              ? new Date(stats.notifications.latestOutboxEventAt).toLocaleString()
              : "No recent activity yet"}
          </p>
        </div>
      </section>
    </div>
  );
}

/* ================= COMPONENT ================= */

const kpiToneClasses = {
  emerald:
    "border-emerald-200/80 bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_48%,#ffffff_100%)] text-emerald-900",
  sky: "border-sky-200/80 bg-[linear-gradient(135deg,#f0f9ff_0%,#dbeafe_50%,#ffffff_100%)] text-sky-900",
  amber:
    "border-amber-200/80 bg-[linear-gradient(135deg,#fffbeb_0%,#fde68a_42%,#ffffff_100%)] text-amber-900",
  rose: "border-slate-200/80 bg-[linear-gradient(135deg,#f8fafc_0%,#e2e8f0_46%,#ffffff_100%)] text-slate-900",
};

const KPI = ({ label, value, icon: Icon, tone = "emerald" }) => (
  <div className={`rounded-[24px] border p-4 shadow-[0_16px_36px_rgba(15,23,42,0.06)] ${kpiToneClasses[tone] || kpiToneClasses.emerald}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
        <p className="mt-2 text-2xl font-black">{value}</p>
      </div>
      <div className="rounded-2xl bg-white/75 p-3 shadow-sm">
        <Icon size={24} />
      </div>
    </div>
  </div>
);

const toneClasses = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  violet: "border-teal-200 bg-teal-50 text-teal-700",
  rose: "border-slate-200 bg-slate-50 text-slate-700",
};

const HealthCard = ({ label, value, suffix = "", tone = "emerald" }) => (
  <div className={`rounded-2xl border p-4 shadow-sm ${toneClasses[tone] || toneClasses.emerald}`}>
    <p className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</p>
    <p className="mt-2 text-2xl font-black">{value}</p>
    {suffix ? <p className="mt-1 text-xs opacity-80">{suffix}</p> : null}
  </div>
);


const formatOrderStage = (value) => {
  const labels = {
    pending: "Awaiting payment",
    paid: "Paid",
    processing: "Preparing order",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };

  const normalized = String(value || "").toLowerCase();
  if (normalized.length === 0) {
    return "Unknown";
  }

  return labels[normalized] || normalized.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
};

const PageHint = ({ message }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">{message}</div>
);
