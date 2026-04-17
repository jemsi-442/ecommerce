import { PLACEHOLDER_IMAGE, resolveImageUrl } from "./image";

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const tokenize = (value) =>
  normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

export const normalizeMarketplaceProduct = (product) => ({
  ...product,
  _id: product._id || product.id,
  image: resolveImageUrl([product.imageUrl, product.image, ...(product.images || [])], PLACEHOLDER_IMAGE),
  countInStock:
    typeof product.countInStock === "number"
      ? product.countInStock
      : typeof product.stock === "number"
        ? product.stock
        : 0,
});

const getAnchorSignals = (product, anchor) => {
  const productTokens = new Set(tokenize(`${product.name} ${product.description}`));
  const anchorTokens = tokenize(`${anchor.name} ${anchor.description}`);
  const sharedTokens = anchorTokens.filter((token) => productTokens.has(token)).length;
  const priceGap = Math.abs(Number(product.price || 0) - Number(anchor.price || 0));

  return {
    sameStore:
      Boolean(product.vendor?.storeSlug) &&
      Boolean(anchor.vendor?.storeSlug) &&
      product.vendor.storeSlug === anchor.vendor.storeSlug,
    sameSeller:
      Boolean(product.vendor?.name) &&
      Boolean(anchor.vendor?.name) &&
      product.vendor.name === anchor.vendor.name,
    sharedTokens,
    priceGap,
  };
};

const scoreProductAgainstAnchors = (product, anchors) => {
  return anchors.reduce((score, anchor) => {
    let nextScore = score;
    const { sameStore, sameSeller, sharedTokens, priceGap } = getAnchorSignals(product, anchor);

    if (sameStore) {
      nextScore += 5;
    }

    if (sameSeller) {
      nextScore += 3;
    }

    nextScore += sharedTokens;

    if (priceGap <= 20000) nextScore += 2;
    else if (priceGap <= 50000) nextScore += 1;

    if (Number(product.countInStock || 0) > 0) {
      nextScore += 1;
    }

    return nextScore;
  }, 0);
};

export const getRecommendationReason = ({ product, anchors = [] }) => {
  const safeProduct = normalizeMarketplaceProduct(product);
  const safeAnchors = anchors.filter(Boolean).map(normalizeMarketplaceProduct);

  let sameStoreHits = 0;
  let sameSellerHits = 0;
  let styleMatches = 0;
  let closePriceMatches = 0;

  safeAnchors.forEach((anchor) => {
    const { sameStore, sameSeller, sharedTokens, priceGap } = getAnchorSignals(safeProduct, anchor);

    if (sameStore) sameStoreHits += 1;
    if (sameSeller) sameSellerHits += 1;
    if (sharedTokens >= 2) styleMatches += 1;
    if (priceGap <= 20000) closePriceMatches += 1;
    else if (priceGap <= 50000) closePriceMatches += 0.5;
  });

  if (sameStoreHits > 0) {
    return 'From the same store you already explored';
  }

  if (sameSellerHits > 0) {
    return 'From a seller that matches what you were viewing';
  }

  if (styleMatches > 0) {
    return 'Matches the style of items you looked at recently';
  }

  if (closePriceMatches > 0) {
    return 'Close to the price range you have been shopping';
  }

  if (Number(safeProduct.countInStock || 0) > 0) {
    return 'Ready for a smooth checkout right now';
  }

  return 'Another marketplace pick worth a closer look';
};

export const getRecommendedProducts = ({ catalog = [], anchors = [], excludeIds = [], limit = 4 }) => {
  const safeCatalog = catalog.map(normalizeMarketplaceProduct);
  const safeAnchors = anchors.filter(Boolean).map(normalizeMarketplaceProduct);
  const blocked = new Set(excludeIds.map((entry) => String(entry)));

  return safeCatalog
    .filter((product) => !blocked.has(String(product._id)))
    .map((product) => ({
      product,
      score: scoreProductAgainstAnchors(product, safeAnchors),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (Number(b.product.countInStock || 0) !== Number(a.product.countInStock || 0)) {
        return Number(b.product.countInStock || 0) - Number(a.product.countInStock || 0);
      }
      return Number(a.product.price || 0) - Number(b.product.price || 0);
    })
    .map((entry) => entry.product)
    .slice(0, limit);
};
