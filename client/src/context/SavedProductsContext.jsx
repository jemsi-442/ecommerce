import { createContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import api from "../utils/axios";
import { extractList } from "../utils/apiShape";
import { PLACEHOLDER_IMAGE, resolveImageUrl } from "../utils/image";

export const SavedProductsContext = createContext(null);

const SAVED_PRODUCTS_STORAGE_KEY = "ecommerce_saved_products";
const FAVORITE_STORES_STORAGE_KEY = "ecommerce_favorite_stores";
const RECENT_PRODUCTS_STORAGE_KEY = "ecommerce_recent_products";
const RECENT_LIMIT = 8;

const readStorage = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeProductId = (value) => {
  const productId = Number.parseInt(value, 10);
  return Number.isInteger(productId) && productId > 0 ? productId : null;
};

const normalizeStoreSlug = (value) => {
  if (!value) return null;
  const slug = String(value).trim().toLowerCase();
  return slug || null;
};

const makeStoreSnapshot = (input) => {
  if (!input) return null;

  const vendorSource = input.vendor || input.store || input;
  const storeSlug = normalizeStoreSlug(vendorSource.storeSlug || vendorSource.slug);
  if (!storeSlug) return null;

  return {
    slug: storeSlug,
    name: vendorSource.storeName || vendorSource.name || storeSlug,
    businessPhone: vendorSource.businessPhone || null,
    businessDescription: vendorSource.businessDescription || vendorSource.description || null,
    sampleImage: resolveImageUrl(
      [vendorSource.sampleImage, vendorSource.image, input.sampleImage, input.image, input.imageUrl, ...(input.images || [])],
      PLACEHOLDER_IMAGE
    ),
    itemCount: Number(vendorSource.itemCount || input.itemCount || 0),
    inStockCount: Number(vendorSource.inStockCount || input.inStockCount || 0),
    startingPrice: Number(vendorSource.startingPrice || input.startingPrice || 0),
  };
};

const makeSnapshot = (product) => {
  if (!product) return null;

  const productId = normalizeProductId(product._id || product.id || product.productId);
  if (!productId) return null;

  return {
    _id: productId,
    name: product.name || "Product",
    price: Number(product.price || 0),
    image: resolveImageUrl([product.image, product.imageUrl, ...(product.images || [])], PLACEHOLDER_IMAGE),
    description: product.description || "",
    countInStock:
      typeof product.countInStock === "number"
        ? product.countInStock
        : typeof product.stock === "number"
          ? product.stock
          : 0,
    vendor: product.vendor
      ? {
          name: product.vendor.storeName || product.vendor.name || null,
          storeSlug: product.vendor.storeSlug || null,
        }
      : null,
  };
};

const uniqueSnapshots = (items) => {
  const unique = [];
  const seen = new Set();

  for (const item of items) {
    const snapshot = makeSnapshot(item);
    const productId = snapshot?._id;
    if (!productId || seen.has(productId)) {
      continue;
    }

    seen.add(productId);
    unique.push(snapshot);
  }

  return unique;
};

const uniqueStoreSnapshots = (items) => {
  const unique = [];
  const seen = new Set();

  for (const item of items) {
    const snapshot = makeStoreSnapshot(item);
    const storeSlug = snapshot?.slug;
    if (!storeSlug || seen.has(storeSlug)) {
      continue;
    }

    seen.add(storeSlug);
    unique.push(snapshot);
  }

  return unique;
};

const mergeSnapshots = (primary, secondary) => uniqueSnapshots([...(primary || []), ...(secondary || [])]);
const mergeStoreSnapshots = (primary, secondary) => uniqueStoreSnapshots([...(primary || []), ...(secondary || [])]);

export const SavedProductsProvider = ({ children }) => {
  const { user } = useAuth();
  const [savedProducts, setSavedProducts] = useState(() => readStorage(SAVED_PRODUCTS_STORAGE_KEY));
  const [favoriteStores, setFavoriteStores] = useState(() => readStorage(FAVORITE_STORES_STORAGE_KEY));
  const [recentProducts, setRecentProducts] = useState(() => readStorage(RECENT_PRODUCTS_STORAGE_KEY));
  const [syncingSavedProducts, setSyncingSavedProducts] = useState(false);
  const [syncingFavoriteStores, setSyncingFavoriteStores] = useState(false);
  const latestSavedSyncRequestRef = useRef(0);
  const latestFavoriteStoreSyncRequestRef = useRef(0);

  const isSignedInCustomer = Boolean(user?.token) && ["customer", "user"].includes(user?.role);

  useEffect(() => {
    localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify(savedProducts));
  }, [savedProducts]);

  useEffect(() => {
    localStorage.setItem(FAVORITE_STORES_STORAGE_KEY, JSON.stringify(favoriteStores));
  }, [favoriteStores]);

  useEffect(() => {
    localStorage.setItem(RECENT_PRODUCTS_STORAGE_KEY, JSON.stringify(recentProducts));
  }, [recentProducts]);

  const syncSavedProductIds = async (productIds) => {
    const requestId = ++latestSavedSyncRequestRef.current;
    setSyncingSavedProducts(true);

    try {
      const { data } = await api.put("/users/me/saved-products", { productIds });
      const syncedItems = uniqueSnapshots(extractList(data, ["items"]));

      if (requestId === latestSavedSyncRequestRef.current) {
        setSavedProducts(syncedItems);
      }
    } catch (error) {
      console.error("Failed to sync saved products", error);
    } finally {
      if (requestId === latestSavedSyncRequestRef.current) {
        setSyncingSavedProducts(false);
      }
    }
  };

  const syncFavoriteStoreSlugs = async (storeSlugs) => {
    const requestId = ++latestFavoriteStoreSyncRequestRef.current;
    setSyncingFavoriteStores(true);

    try {
      const { data } = await api.put("/users/me/favorite-stores", { storeSlugs });
      const syncedItems = uniqueStoreSnapshots(extractList(data, ["items"]));

      if (requestId === latestFavoriteStoreSyncRequestRef.current) {
        setFavoriteStores(syncedItems);
      }
    } catch (error) {
      console.error("Failed to sync favorite stores", error);
    } finally {
      if (requestId === latestFavoriteStoreSyncRequestRef.current) {
        setSyncingFavoriteStores(false);
      }
    }
  };

  useEffect(() => {
    if (!isSignedInCustomer) {
      setSyncingSavedProducts(false);
      return undefined;
    }

    let active = true;
    const localSnapshots = uniqueSnapshots(savedProducts);

    const hydrateSavedProducts = async () => {
      const requestId = ++latestSavedSyncRequestRef.current;
      setSyncingSavedProducts(true);

      try {
        const { data } = await api.get("/users/me/saved-products");
        const remoteSnapshots = uniqueSnapshots(extractList(data, ["items"]));
        const mergedSnapshots = mergeSnapshots(localSnapshots, remoteSnapshots);
        const remoteIds = remoteSnapshots.map((item) => item._id);
        const mergedIds = mergedSnapshots.map((item) => item._id);

        if (!active || requestId !== latestSavedSyncRequestRef.current) {
          return;
        }

        if (JSON.stringify(remoteIds) !== JSON.stringify(mergedIds)) {
          await syncSavedProductIds(mergedIds);
          return;
        }

        setSavedProducts(remoteSnapshots);
      } catch (error) {
        console.error("Failed to hydrate saved products", error);
      } finally {
        if (active && requestId === latestSavedSyncRequestRef.current) {
          setSyncingSavedProducts(false);
        }
      }
    };

    hydrateSavedProducts();

    return () => {
      active = false;
    };
  }, [isSignedInCustomer, user?.token]);

  useEffect(() => {
    if (!isSignedInCustomer) {
      setSyncingFavoriteStores(false);
      return undefined;
    }

    let active = true;
    const localSnapshots = uniqueStoreSnapshots(favoriteStores);

    const hydrateFavoriteStores = async () => {
      const requestId = ++latestFavoriteStoreSyncRequestRef.current;
      setSyncingFavoriteStores(true);

      try {
        const { data } = await api.get("/users/me/favorite-stores");
        const remoteSnapshots = uniqueStoreSnapshots(extractList(data, ["items"]));
        const mergedSnapshots = mergeStoreSnapshots(localSnapshots, remoteSnapshots);
        const remoteSlugs = remoteSnapshots.map((item) => item.slug);
        const mergedSlugs = mergedSnapshots.map((item) => item.slug);

        if (!active || requestId !== latestFavoriteStoreSyncRequestRef.current) {
          return;
        }

        if (JSON.stringify(remoteSlugs) !== JSON.stringify(mergedSlugs)) {
          await syncFavoriteStoreSlugs(mergedSlugs);
          return;
        }

        setFavoriteStores(remoteSnapshots);
      } catch (error) {
        console.error("Failed to hydrate favorite stores", error);
      } finally {
        if (active && requestId === latestFavoriteStoreSyncRequestRef.current) {
          setSyncingFavoriteStores(false);
        }
      }
    };

    hydrateFavoriteStores();

    return () => {
      active = false;
    };
  }, [isSignedInCustomer, user?.token]);

  const toggleSavedProduct = (product) => {
    const snapshot = makeSnapshot(product);
    if (!snapshot) return false;

    let added = false;
    let nextSnapshots = [];

    setSavedProducts((current) => {
      const exists = current.some((entry) => Number(entry._id) === Number(snapshot._id));
      if (exists) {
        nextSnapshots = current.filter((entry) => Number(entry._id) !== Number(snapshot._id));
        return nextSnapshots;
      }

      added = true;
      nextSnapshots = [snapshot, ...current.filter((entry) => Number(entry._id) !== Number(snapshot._id))];
      return nextSnapshots;
    });

    if (isSignedInCustomer) {
      void syncSavedProductIds(nextSnapshots.map((entry) => entry._id));
    }

    return added;
  };

  const toggleFavoriteStore = (store) => {
    const snapshot = makeStoreSnapshot(store);
    if (!snapshot) return false;

    let added = false;
    let nextSnapshots = [];

    setFavoriteStores((current) => {
      const exists = current.some((entry) => entry.slug === snapshot.slug);
      if (exists) {
        nextSnapshots = current.filter((entry) => entry.slug !== snapshot.slug);
        return nextSnapshots;
      }

      added = true;
      nextSnapshots = [snapshot, ...current.filter((entry) => entry.slug !== snapshot.slug)];
      return nextSnapshots;
    });

    if (isSignedInCustomer) {
      void syncFavoriteStoreSlugs(nextSnapshots.map((entry) => entry.slug));
    }

    return added;
  };

  const isSavedProduct = (productId) =>
    savedProducts.some((entry) => Number(entry._id) === Number(productId));

  const isFavoriteStore = (storeSlug) =>
    favoriteStores.some((entry) => entry.slug === normalizeStoreSlug(storeSlug));

  const recordRecentlyViewed = (product) => {
    const snapshot = makeSnapshot(product);
    if (!snapshot) return;

    setRecentProducts((current) => [
      snapshot,
      ...current.filter((entry) => Number(entry._id) !== Number(snapshot._id)),
    ].slice(0, RECENT_LIMIT));
  };

  const removeSavedProduct = (productId) => {
    let nextSnapshots = [];
    setSavedProducts((current) => {
      nextSnapshots = current.filter((entry) => Number(entry._id) !== Number(productId));
      return nextSnapshots;
    });

    if (isSignedInCustomer) {
      void syncSavedProductIds(nextSnapshots.map((entry) => entry._id));
    }
  };

  const removeFavoriteStore = (storeSlug) => {
    let nextSnapshots = [];
    setFavoriteStores((current) => {
      nextSnapshots = current.filter((entry) => entry.slug !== normalizeStoreSlug(storeSlug));
      return nextSnapshots;
    });

    if (isSignedInCustomer) {
      void syncFavoriteStoreSlugs(nextSnapshots.map((entry) => entry.slug));
    }
  };

  const clearRecentProducts = () => setRecentProducts([]);

  const value = useMemo(() => ({
    savedProducts,
    favoriteStores: uniqueStoreSnapshots(favoriteStores),
    recentProducts,
    savedCount: savedProducts.length,
    favoriteStoreCount: favoriteStores.length,
    syncingSavedProducts,
    syncingFavoriteStores,
    toggleSavedProduct,
    toggleFavoriteStore,
    removeSavedProduct,
    removeFavoriteStore,
    isSavedProduct,
    isFavoriteStore,
    recordRecentlyViewed,
    clearRecentProducts,
  }), [favoriteStores, recentProducts, savedProducts, syncingFavoriteStores, syncingSavedProducts]);

  return <SavedProductsContext.Provider value={value}>{children}</SavedProductsContext.Provider>;
};
