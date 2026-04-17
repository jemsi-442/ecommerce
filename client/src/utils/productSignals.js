const makeLabel = (label, tone) => ({ label, tone });

export const getSignalToneClasses = (tone) => {
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

export const getProductBadges = (product, { index = 0 } = {}) => {
  const stock = Number(product?.countInStock || 0);
  const price = Number(product?.price || 0);
  const reviewCount = Number(product?.reviewCount || 0);
  const averageRating = Number(product?.averageRating || 0);
  const badges = [];

  if (index < 3) {
    badges.push(makeLabel("Popular this week", "sky"));
  }

  if (stock > 0 && stock <= 2) {
    badges.push(makeLabel(`Only ${stock} left`, "rose"));
  } else if (stock > 0 && stock <= 5) {
    badges.push(makeLabel("Low stock", "amber"));
  }

  if (stock >= 8) {
    badges.push(makeLabel("Fast delivery eligible", "emerald"));
  }

  if (product?.vendor?.storeSlug) {
    badges.push(makeLabel("Seller highlight", "amber-soft"));
  }

  if (price > 0 && price <= 50000) {
    badges.push(makeLabel("Value pick", "emerald-soft"));
  }

  if (reviewCount >= 5 && averageRating >= 4.5) {
    badges.push(makeLabel("Top rated", "amber"));
  } else if (reviewCount >= 2 && averageRating >= 4) {
    badges.push(makeLabel("Rated by shoppers", "sky"));
  }

  return badges;
};

export const getProductNudge = (product, { index = 0 } = {}) => {
  const stock = Number(product?.countInStock || 0);
  const seller = product?.vendor?.storeName || product?.vendor?.name || "this seller";
  const reviewCount = Number(product?.reviewCount || 0);
  const averageRating = Number(product?.averageRating || 0);

  if (reviewCount >= 5 && averageRating >= 4.5) {
    return `Shoppers are rating this highly, with ${averageRating.toFixed(1)} stars across ${reviewCount} reviews.`;
  }

  if (reviewCount >= 2 && averageRating >= 4) {
    return `A shopper-backed pick with ${averageRating.toFixed(1)} stars from recent buyers.`;
  }

  if (stock > 0 && stock <= 2) {
    return `Only ${stock} left right now, so this is a good moment to check out.`;
  }

  if (stock > 0 && stock <= 5) {
    return "Stock is moving quickly on this product right now.";
  }

  if (index < 3) {
    return "One of the marketplace picks shoppers are noticing most this week.";
  }

  if (stock >= 8) {
    return "Ready for a smoother checkout and delivery flow.";
  }

  if (product?.vendor?.storeSlug) {
    return `A strong seller-backed pick from ${seller}.`;
  }

  return "A solid marketplace pick worth a closer look.";
};
