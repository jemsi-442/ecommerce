const makeBadge = (label, tone) => ({ label, tone });

export const getStoreSignalToneClasses = (tone) => {
  switch (tone) {
    case "rose":
      return "bg-rose-500/90 text-white shadow-sm";
    case "amber":
      return "bg-amber-500/90 text-white shadow-sm";
    case "sky":
      return "bg-sky-500/90 text-white shadow-sm";
    case "emerald":
      return "bg-emerald-500/90 text-white shadow-sm";
    case "emerald-soft":
      return "bg-emerald-50 text-emerald-700";
    case "amber-soft":
      return "bg-amber-50 text-amber-700";
    case "slate":
    default:
      return "bg-white/90 text-slate-700 shadow-sm";
  }
};

export const getStoreBadges = (store) => {
  const reviewCount = Number(store?.reviewCount || 0);
  const averageRating = Number(store?.averageRating || 0);
  const readyNow = Number(store?.readyNowCount || store?.inStockCount || 0);
  const itemCount = Number(store?.itemCount || store?.liveItems || 0);
  const startingPrice = Number(store?.startingPrice || 0);
  const badges = [];

  if (reviewCount >= 8 && averageRating >= 4.5) {
    badges.push(makeBadge("Top rated store", "amber"));
  } else if (reviewCount >= 3 && averageRating >= 4) {
    badges.push(makeBadge("Trusted by shoppers", "sky"));
  }

  if (readyNow >= 5) {
    badges.push(makeBadge("Ready to ship", "emerald"));
  }

  if (itemCount >= 6) {
    badges.push(makeBadge("Growing seller", "amber-soft"));
  }

  if (startingPrice > 0 && startingPrice <= 50000 && itemCount >= 3) {
    badges.push(makeBadge("Value storefront", "emerald-soft"));
  }

  return badges;
};

export const getStoreNudge = (store) => {
  const reviewCount = Number(store?.reviewCount || 0);
  const averageRating = Number(store?.averageRating || 0);
  const readyNow = Number(store?.readyNowCount || store?.inStockCount || 0);
  const itemCount = Number(store?.itemCount || store?.liveItems || 0);

  if (reviewCount >= 8 && averageRating >= 4.5) {
    return `One of the strongest-rated seller shelves on the marketplace right now.`;
  }

  if (reviewCount >= 3 && averageRating >= 4) {
    return `Shoppers are already backing this store with strong reviews.`;
  }

  if (readyNow >= 5) {
    return `A strong store to open when you want more ready-to-checkout picks.`;
  }

  if (itemCount >= 6) {
    return `This storefront already has enough depth to build a fuller basket.`;
  }

  return `A seller shelf worth exploring as the marketplace keeps growing.`;
};
