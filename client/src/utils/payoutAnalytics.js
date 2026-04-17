const monthKey = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, { month: "short", year: "numeric" });
};

const daysBetween = (startValue, endValue) => {
  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
};

export const buildPayoutTrendData = (records = []) => {
  const buckets = new Map();

  for (const record of records) {
    const key = monthKey(record.paidAt || record.createdAt || record.order?.deliveredAt || null);
    if (!buckets.has(key)) {
      buckets.set(key, {
        label: key,
        paid: 0,
        pending: 0,
        onHold: 0,
      });
    }

    const bucket = buckets.get(key);
    const amount = Number(record.amount || 0);
    if (record.status === "paid") bucket.paid += amount;
    else if (record.status === "on_hold") bucket.onHold += amount;
    else bucket.pending += amount;
  }

  return Array.from(buckets.values()).slice(-6);
};

export const buildPayoutStatusChartData = (records = [], readyQueue = []) => {
  const totals = {
    Paid: 0,
    Pending: 0,
    "On Hold": 0,
    "Ready Queue": 0,
  };

  for (const record of records) {
    const amount = Number(record.amount || 0);
    if (record.status === "paid") totals.Paid += amount;
    else if (record.status === "on_hold") totals["On Hold"] += amount;
    else totals.Pending += amount;
  }

  for (const entry of readyQueue) {
    totals["Ready Queue"] += Number(entry.amount || 0);
  }

  return Object.entries(totals)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
};

export const buildTopVendorPayouts = (records = [], limit = 5) => {
  const vendors = new Map();

  for (const record of records) {
    const vendorId = record.vendor?.id || record.vendorId || record.vendor?._id;
    const vendorName = record.vendor?.storeName || record.vendor?.name || "Unknown vendor";
    const storeSlug = record.vendor?.storeSlug || "store";
    const amount = Number(record.amount || 0);

    if (!vendors.has(vendorId)) {
      vendors.set(vendorId, {
        id: vendorId,
        name: vendorName,
        storeSlug,
        total: 0,
        paid: 0,
        pending: 0,
        onHold: 0,
        records: 0,
      });
    }

    const vendor = vendors.get(vendorId);
    vendor.total += amount;
    vendor.records += 1;
    if (record.status === "paid") vendor.paid += amount;
    else if (record.status === "on_hold") vendor.onHold += amount;
    else vendor.pending += amount;
  }

  return Array.from(vendors.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map((vendor) => ({
      ...vendor,
      total: Number(vendor.total.toFixed(2)),
      paid: Number(vendor.paid.toFixed(2)),
      pending: Number(vendor.pending.toFixed(2)),
      onHold: Number(vendor.onHold.toFixed(2)),
    }));
};

export const buildSettlementPerformance = (records = []) => {
  const durations = records
    .filter((record) => record.status === "paid")
    .map((record) => ({
      record,
      days: daysBetween(record.createdAt, record.paidAt),
    }))
    .filter((entry) => entry.days !== null && entry.days >= 0);

  if (!durations.length) {
    return {
      averageDays: null,
      fastestDays: null,
      slowestDays: null,
      settledCount: 0,
    };
  }

  const days = durations.map((entry) => entry.days);
  return {
    averageDays: Number((days.reduce((sum, value) => sum + value, 0) / days.length).toFixed(1)),
    fastestDays: Number(Math.min(...days).toFixed(1)),
    slowestDays: Number(Math.max(...days).toFixed(1)),
    settledCount: durations.length,
  };
};

export const buildBestPayoutMonth = (records = []) => {
  const buckets = new Map();

  for (const record of records) {
    if (record.status !== "paid") continue;
    const key = monthKey(record.paidAt || record.createdAt || null);
    buckets.set(key, (buckets.get(key) || 0) + Number(record.amount || 0));
  }

  if (!buckets.size) {
    return {
      label: "No paid month yet",
      amount: 0,
    };
  }

  const [label, amount] = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1])[0];
  return {
    label,
    amount: Number(amount.toFixed(2)),
  };
};
