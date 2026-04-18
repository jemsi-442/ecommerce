import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FiBell, FiCheck, FiClock, FiEdit3, FiHeart, FiMapPin, FiPhone, FiRefreshCw, FiShoppingBag, FiUser } from "react-icons/fi";
import MarketplaceRating from "../components/MarketplaceRating";
import RecommendationShelf from "../components/RecommendationShelf";
import api from "../utils/axios";
import OrderCard from "../components/OrderCard";
import { extractList } from "../utils/apiShape";
import useNotificationPreferences from "../hooks/useNotificationPreferences";
import { useToast } from "../hooks/useToast";
import { getRecommendedProducts, getRecommendationReason } from "../utils/marketplaceRecommendations";
import { validatePhoneForNetwork } from "../utils/mobileMoneyNetworks";
import { useAuth } from "../hooks/useAuth";
import { useSavedProducts } from "../hooks/useSavedProducts";
import { useCart } from "../hooks/useCart";

export default function Orders() {
  const toast = useToast();
  const { addToCart, cart } = useCart();
  const { user, updateUser } = useAuth();
  const {
    clearRecentProducts,
    favoriteStores,
    favoriteStoreCount,
    isSavedProduct,
    recentProducts,
    removeFavoriteStore,
    removeSavedProduct,
    savedProducts,
    syncingSavedProducts,
    toggleSavedProduct,
  } = useSavedProducts();
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", createdAt: "" });
  const [profileBusy, setProfileBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [recentReorder, setRecentReorder] = useState(null);
  const [reviewInsights, setReviewInsights] = useState({});
  const [activeReview, setActiveReview] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewCelebration, setReviewCelebration] = useState(null);
  const [selectedLaneKey, setSelectedLaneKey] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('shopper-best-lane') || '';
  });
  const [laneHistoryKeys, setLaneHistoryKeys] = useState(() => {
    if (typeof window === 'undefined') return [];

    try {
      const stored = window.localStorage.getItem('shopper-lane-history');
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const notificationPreferences = useNotificationPreferences("customer");

  const fetchOrders = () => {
    api
      .get("/orders/my")
      .then((res) => {
        setOrders(extractList(res.data, ["orders", "items"]));
      })
      .catch(() => {
        setOrders([]);
      });
  };

  const fetchNotifications = () => {
    api
      .get("/notifications/my")
      .then((res) => {
        setNotifications(extractList(res.data, ["items", "notifications"]));
      })
      .catch(() => {
        setNotifications([]);
      });
  };


  const fetchCatalog = () => {
    api
      .get("/products?status=approved")
      .then((res) => {
        setCatalog(extractList(res.data, ["products", "items"]));
      })
      .catch(() => {
        setCatalog([]);
      });
  };

  const fetchProfile = () => {
    api
      .get("/users/me")
      .then((res) => {
        const nextProfile = res.data?.data || res.data;
        if (!nextProfile) return;
        setProfile({
          name: nextProfile.name || "",
          email: nextProfile.email || "",
          phone: nextProfile.phone || "",
          createdAt: nextProfile.createdAt || "",
        });
        updateUser?.(nextProfile);
      })
      .catch(() => {
        setProfile({
          name: user?.name || "",
          email: user?.email || "",
          phone: user?.phone || "",
          createdAt: user?.createdAt || "",
        });
      });
  };

  useEffect(() => {
    fetchOrders();
    fetchNotifications();
    fetchProfile();
    fetchCatalog();
  }, []);

  useEffect(() => {
    const deliveredProductIds = Array.from(
      new Set(
        orders
          .filter((order) => order.status === "delivered")
          .flatMap((order) => order.items || [])
          .map((item) => item.product)
          .filter(Boolean)
          .map((entry) => String(entry))
      )
    );

    if (!deliveredProductIds.length) {
      setReviewInsights({});
      return undefined;
    }

    let active = true;

    const fetchReviewInsights = async () => {
      try {
        const responses = await Promise.all(
          deliveredProductIds.map((productId) =>
            api.get(`/products/${productId}/reviews`).then((response) => ({
              productId,
              payload: response.data?.data || response.data || {},
            }))
          )
        );

        if (!active) {
          return;
        }

        const nextInsights = responses.reduce((acc, entry) => {
          acc[String(entry.productId)] = entry.payload;
          return acc;
        }, {});

        setReviewInsights(nextInsights);
      } catch (error) {
        if (active) {
          setReviewInsights({});
        }
      }
    };

    fetchReviewInsights();

    return () => {
      active = false;
    };
  }, [orders]);

  useEffect(() => {
    const hasTrackableOrders = orders.some(
      (order) => !["delivered", "cancelled", "refunded"].includes(order.status)
    );
    const hasUnreadNotifications = notifications.some((notification) => !notification.read);

    if (!hasTrackableOrders && !hasUnreadNotifications) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      fetchOrders();
      fetchNotifications();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [notifications, orders]);

  const markNotificationRead = async (notificationId) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      setNotifications((current) =>
        current.map((notification) =>
          notification._id === notificationId ? { ...notification, read: true } : notification
        )
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to mark notification as read");
    }
  };

  const refreshPaymentStatus = async (orderId) => {
    try {
      setBusyId(orderId);
      const { data } = await api.get(`/orders/${orderId}/payment-status`);
      toast.success(data?.message || "Payment status refreshed");
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to refresh payment status");
    } finally {
      setBusyId(null);
    }
  };

  const retryPaymentPush = async (orderId, network) => {
    try {
      const order = orders.find((entry) => entry._id === orderId);
      const phoneValidation = validatePhoneForNetwork(order?.delivery?.contactPhone || "", network);

      if (!phoneValidation.valid) {
        toast.error(phoneValidation.message);
        return;
      }

      setBusyId(orderId);
      const { data } = await api.post(`/orders/${orderId}/payment-push`, { network });
      toast.success(data?.message || "New mobile money prompt created");
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create a new mobile money prompt");
    } finally {
      setBusyId(null);
    }
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    try {
      setProfileBusy(true);
      const { data } = await api.patch("/users/me", profile);
      const nextUser = data?.data || data;
      updateUser?.(nextUser);
      setProfile({
        name: nextUser.name || "",
        email: nextUser.email || "",
        phone: nextUser.phone || "",
        createdAt: nextUser.createdAt || profile.createdAt || "",
      });
      toast.success(data?.message || "Profile updated successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setProfileBusy(false);
    }
  };

  const cartProductQuantities = useMemo(() => {
    const quantities = new Map();

    cart.forEach((item) => {
      const key = String(item.productId);
      quantities.set(key, (quantities.get(key) || 0) + Number(item.qty || 0));
    });

    return quantities;
  }, [cart]);

  const getCartQuantity = (productId) => cartProductQuantities.get(String(productId)) || 0;

  const orderStats = useMemo(() => {
    const paidOrders = orders.filter((order) => order.payment?.isPaid || order.isPaid).length;
    const activeOrders = orders.filter((order) => !["delivered", "cancelled", "refunded"].includes(order.status)).length;
    const awaitingPayment = orders.filter((order) => order.status === "pending" && !(order.payment?.isPaid || order.isPaid)).length;
    const movingOrders = orders.filter((order) => ["paid", "out_for_delivery"].includes(order.status)).length;
    const deliveredOrders = orders.filter((order) => order.status === "delivered").length;
    const spent = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const unread = notifications.filter((notification) => !notification.read).length;

    return {
      totalOrders: orders.length,
      paidOrders,
      activeOrders,
      awaitingPayment,
      movingOrders,
      deliveredOrders,
      spent,
      unread,
    };
  }, [notifications, orders]);

  const latestDeliveryAddress = useMemo(() => {
    return orders.find((order) => order.delivery?.address)?.delivery?.address || "No delivery address yet";
  }, [orders]);

  const latestContactPhone = useMemo(() => {
    return profile.phone || orders.find((order) => order.delivery?.contactPhone)?.delivery?.contactPhone || "No phone added yet";
  }, [orders, profile.phone]);

  const joinedAtLabel = useMemo(() => {
    if (!profile.createdAt) {
      return "Recently";
    }

    const date = new Date(profile.createdAt);
    if (Number.isNaN(date.getTime())) {
      return "Recently";
    }

    return date.toLocaleString();
  }, [profile.createdAt]);


  const favoriteStoreCards = useMemo(() => {
    if (!favoriteStores.length) {
      return [];
    }

    const storeMap = new Map();

    catalog.forEach((product) => {
      const vendor = product.vendor;
      if (!vendor?.storeSlug) {
        return;
      }

      const key = vendor.storeSlug;
      const current = storeMap.get(key) || {
        name: vendor.storeName || vendor.name || vendor.storeSlug,
        slug: vendor.storeSlug,
        itemCount: 0,
        inStockCount: 0,
        sampleImage: product.image,
        startingPrice: 0,
        ratingValue: 0,
        reviewCount: 0,
      };

      current.itemCount += 1;
      if ((product.countInStock || 0) > 0) {
        current.inStockCount += 1;
      }
      if (!current.sampleImage) {
        current.sampleImage = product.image;
      }
      if (Number(product.price || 0) > 0) {
        current.startingPrice = current.startingPrice > 0 ? Math.min(current.startingPrice, Number(product.price || 0)) : Number(product.price || 0);
      }
      if (Number(product.reviewCount || 0) > 0) {
        current.ratingValue += Number(product.averageRating || 0) * Number(product.reviewCount || 0);
        current.reviewCount += Number(product.reviewCount || 0);
      }

      storeMap.set(key, current);
    });

    return favoriteStores.map((store) => ({
      ...store,
      ...(storeMap.get(store.slug) || {}),
      name: (storeMap.get(store.slug) || {}).name || store.name,
      sampleImage: (storeMap.get(store.slug) || {}).sampleImage || store.sampleImage,
      averageRating: (storeMap.get(store.slug) || {}).reviewCount
        ? Number((((storeMap.get(store.slug) || {}).ratingValue || 0) / ((storeMap.get(store.slug) || {}).reviewCount || 1)).toFixed(1))
        : 0,
      reviewCount: (storeMap.get(store.slug) || {}).reviewCount || 0,
    }));
  }, [catalog, favoriteStores]);


  const handleWishlistAddToCart = (product) => {
    const stock = Number(product.countInStock || 0);

    if (stock <= 0) {
      toast.error(`${product.name} is currently unavailable`);
      return;
    }

    addToCart({
      productId: product._id,
      name: product.name,
      price: Number(product.price || 0),
      image: product.image,
      qty: 1,
      stock,
      variant: null,
    });

    toast.success(`${product.name} added to cart`);
  };

  const handleWishlistAddAllToCart = () => {
    const readyProducts = savedProducts.filter((product) => Number(product.countInStock || 0) > 0);

    if (!readyProducts.length) {
      toast.error("No saved products are ready to add right now");
      return;
    }

    readyProducts.forEach((product) => {
      addToCart({
        productId: product._id,
        name: product.name,
        price: Number(product.price || 0),
        image: product.image,
        qty: 1,
        stock: Number(product.countInStock || 0),
        variant: null,
      });
    });

    toast.success(`${readyProducts.length} saved product${readyProducts.length === 1 ? "" : "s"} added to cart`);
  };


  const handleRecentToggleSaved = (product) => {
    const added = toggleSavedProduct(product);
    toast.success(added ? `${product.name} saved` : `${product.name} removed from saved items`);
  };


  const handleRemoveFavoriteStore = (store) => {
    removeFavoriteStore(store.slug);
    toast.success(`${store.name} removed from favorite stores`);
  };


  const accountRecommendationAnchors = useMemo(() => {
    const orderAnchors = orders
      .flatMap((order) => order.items || [])
      .slice(0, 6)
      .map((item) => ({
        _id: item.product,
        name: item.name,
        price: Number(item.price || 0),
        description: "",
      }));

    return [...savedProducts.slice(0, 4), ...recentProducts.slice(0, 4), ...orderAnchors].slice(0, 8);
  }, [orders, recentProducts, savedProducts]);

  const continueShoppingProducts = useMemo(() => {
    if (!accountRecommendationAnchors.length) {
      return [];
    }

    return getRecommendedProducts({
      catalog,
      anchors: accountRecommendationAnchors,
      excludeIds: accountRecommendationAnchors.map((item) => item._id),
      limit: 4,
    });
  }, [accountRecommendationAnchors, catalog]);

  const topRatedAccountProducts = useMemo(() => {
    return catalog
      .filter((product) => Number(product.reviewCount || 0) > 0)
      .sort((a, b) => {
        const ratingGap = Number(b.averageRating || 0) - Number(a.averageRating || 0);
        if (ratingGap !== 0) {
          return ratingGap;
        }

        const reviewGap = Number(b.reviewCount || 0) - Number(a.reviewCount || 0);
        if (reviewGap !== 0) {
          return reviewGap;
        }

        return Number(a.price || 0) - Number(b.price || 0);
      })
      .slice(0, 4);
  }, [catalog]);

  const handleAccountRecommendationAddToCart = (product) => {
    const stock = Number(product.countInStock || 0);
    if (stock <= 0) {
      toast.error(`${product.name} is currently unavailable`);
      return;
    }

    addToCart({
      productId: product._id,
      name: product.name,
      price: Number(product.price || 0),
      image: product.image,
      qty: 1,
      stock,
      variant: null,
    });

    toast.success(`${product.name} added to cart`);
  };

  const handleAccountRecommendationToggleSaved = (product) => {
    const added = toggleSavedProduct(product);
    toast.success(added ? `${product.name} saved for later` : `${product.name} removed from saved items`);
  };


  const handleReorder = (order) => {
    const orderItems = Array.isArray(order?.items) ? order.items : [];

    if (!orderItems.length) {
      toast.error("This order has no items to add again");
      return;
    }

    const catalogById = new Map(catalog.map((product) => [String(product._id), product]));
    let addedLines = 0;
    let skippedLines = 0;
    const addedProducts = [];

    orderItems.forEach((item) => {
      const liveProduct = catalogById.get(String(item.product));
      const stock = Number(liveProduct?.countInStock || 0);

      if (!liveProduct || stock <= 0) {
        skippedLines += 1;
        return;
      }

      addToCart({
        productId: liveProduct._id,
        name: liveProduct.name,
        price: Number(liveProduct.price || 0),
        image: liveProduct.image,
        qty: Math.max(1, Math.min(Number(item.qty || 1), stock)),
        stock,
        variant: null,
      });

      addedProducts.push(liveProduct);
      addedLines += 1;
    });

    if (!addedLines) {
      toast.error("These items are no longer available right now");
      return;
    }

    setRecentReorder({
      orderId: order?._id,
      addedLines,
      skippedLines,
      products: addedProducts,
    });

    if (skippedLines) {
      toast.success(`Added ${addedLines} item ${addedLines === 1 ? "line" : "lines"} to your cart. ${skippedLines} ${skippedLines === 1 ? "item is" : "items are"} not available right now.`);
      return;
    }

    toast.success(`Added ${addedLines} item ${addedLines === 1 ? "line" : "lines"} from this order to your cart`);
  };

  const reportDeliveryIssue = async (order) => {
    const reason = window.prompt("What went wrong with this delivery?");
    if (!reason || !reason.trim()) return;

    try {
      setBusyId(order._id);
      const { data } = await api.post(`/orders/${order._id}/report-delivery-issue`, {
        reason: reason.trim(),
      });
      toast.success(data?.message || "Delivery issue reported");
      fetchOrders();
      fetchNotifications();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to report delivery issue");
    } finally {
      setBusyId(null);
    }
  };


  const reorderRecommendationAnchors = useMemo(() => recentReorder?.products || [], [recentReorder]);

  const reorderRecommendations = useMemo(() => {
    if (!reorderRecommendationAnchors.length) {
      return [];
    }

    return getRecommendedProducts({
      catalog,
      anchors: reorderRecommendationAnchors,
      excludeIds: reorderRecommendationAnchors.map((product) => product._id),
      limit: 4,
    });
  }, [catalog, reorderRecommendationAnchors]);

  const reviewPromptSummary = useMemo(() => {
    const deliveredItems = orders
      .filter((order) => order.status === "delivered")
      .flatMap((order) => order.items || []);

    const uniqueProductIds = Array.from(new Set(deliveredItems.map((item) => String(item.product)).filter(Boolean)));
    const pending = uniqueProductIds.filter((productId) => {
      const insight = reviewInsights[productId];
      return insight?.canReview && !insight?.userReview;
    }).length;
    const completed = uniqueProductIds.filter((productId) => Boolean(reviewInsights[productId]?.userReview)).length;

    return {
      total: uniqueProductIds.length,
      pending,
      completed,
    };
  }, [orders, reviewInsights]);

  const reviewReminderItems = reviewPromptSummary.itemsNeedingReview || [];
  const reviewCompletedCount = Number(reviewPromptSummary?.reviewedCount || 0);
  const reviewTotalTracked = reviewCompletedCount + reviewReminderItems.length;
  const reviewCompletionRate = reviewTotalTracked
    ? Math.round((reviewCompletedCount / reviewTotalTracked) * 100)
    : 0;

  const reviewReminderTargets = useMemo(() => {
    return orders.flatMap((order) =>
      (order.orderItems || [])
        .map((item) => {
          const insight = getReviewInsight(item.product);
          const isDelivered = String(order.status || '').toLowerCase() === 'delivered';
          const needsReview =
            isDelivered &&
            item?.product &&
            (!insight?.userReview) &&
            (insight?.reviewEligibility?.canReview !== false);

          if (!needsReview) return null;

          return {
            orderId: order._id,
            item,
            insight,
          };
        })
        .filter(Boolean)
    );
  }, [orders, reviewInsights]);

  const nextReviewTarget = reviewReminderTargets[0] || null;

  useEffect(() => {
    if (!reviewCelebration) return undefined;

    const timer = window.setTimeout(() => {
      setReviewCelebration(null);
    }, 7000);

    return () => window.clearTimeout(timer);
  }, [reviewCelebration]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (selectedLaneKey) {
      window.localStorage.setItem('shopper-best-lane', selectedLaneKey);
      return;
    }

    window.localStorage.removeItem('shopper-best-lane');
  }, [selectedLaneKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem('shopper-lane-history', JSON.stringify(laneHistoryKeys));
  }, [laneHistoryKeys]);

  const topReviewHighlights = useMemo(() => {
    return [...catalog]
      .map((product) => {
        const summary = product?.ratingSummary || {
          averageRating: Number(product?.averageRating || 0),
          reviewCount: Number(product?.reviewCount || 0),
        };

        return {
          ...product,
          ratingSummary: summary,
          averageRating: Number(summary?.averageRating || 0),
          reviewCount: Number(summary?.reviewCount || 0),
          storeName:
            product?.vendor?.storeName ||
            product?.store?.name ||
            product?.storeName ||
            'Marketplace seller',
        };
      })
      .filter((product) => product.reviewCount > 0 && product.averageRating >= 4)
      .sort((left, right) => {
        if (right.averageRating !== left.averageRating) {
          return right.averageRating - left.averageRating;
        }
        return right.reviewCount - left.reviewCount;
      })
      .slice(0, 4);
  }, [catalog]);

  const reviewLedStores = useMemo(() => {
    const buckets = new Map();

    catalog.forEach((product) => {
      const storeSlug =
        product?.vendor?.storeSlug ||
        product?.store?.slug ||
        product?.storeSlug ||
        '';
      const storeName =
        product?.vendor?.storeName ||
        product?.store?.name ||
        product?.storeName ||
        '';
      const reviewCount = Number(product?.ratingSummary?.reviewCount ?? product?.reviewCount ?? 0);
      const averageRating = Number(product?.ratingSummary?.averageRating ?? product?.averageRating ?? 0);

      if (!storeSlug || !storeName || reviewCount <= 0) return;

      if (!buckets.has(storeSlug)) {
        buckets.set(storeSlug, {
          storeSlug,
          storeName,
          reviewCount: 0,
          weightedRatingTotal: 0,
          productCount: 0,
          bestProduct: null,
        });
      }

      const current = buckets.get(storeSlug);
      current.reviewCount += reviewCount;
      current.weightedRatingTotal += averageRating * reviewCount;
      current.productCount += 1;

      if (
        !current.bestProduct ||
        averageRating > Number(current.bestProduct?.ratingSummary?.averageRating ?? current.bestProduct?.averageRating ?? 0)
      ) {
        current.bestProduct = product;
      }
    });

    return [...buckets.values()]
      .map((entry) => ({
        ...entry,
        averageRating: entry.reviewCount ? entry.weightedRatingTotal / entry.reviewCount : 0,
      }))
      .filter((entry) => entry.reviewCount > 0)
      .sort((left, right) => {
        if (right.averageRating !== left.averageRating) {
          return right.averageRating - left.averageRating;
        }
        return right.reviewCount - left.reviewCount;
      })
      .slice(0, 3);
  }, [catalog]);

  const reviewedStoreFinds = useMemo(() => {
    const reviewedStoreSlugs = new Set();
    const purchasedProductIds = new Set();

    orders.forEach((order) => {
      (order.orderItems || []).forEach((item) => {
        purchasedProductIds.add(String(item.product));

        const insight = getReviewInsight(item.product);
        const product = catalog.find((entry) => String(entry._id) === String(item.product));
        const storeSlug =
          product?.vendor?.storeSlug ||
          product?.store?.slug ||
          product?.storeSlug ||
          '';

        if (insight?.userReview && storeSlug) {
          reviewedStoreSlugs.add(storeSlug);
        }
      });
    });

    return catalog
      .filter((product) => {
        const storeSlug =
          product?.vendor?.storeSlug ||
          product?.store?.slug ||
          product?.storeSlug ||
          '';
        const reviewCount = Number(product?.ratingSummary?.reviewCount ?? product?.reviewCount ?? 0);
        const averageRating = Number(product?.ratingSummary?.averageRating ?? product?.averageRating ?? 0);
        const inStock = Number(product?.countInStock ?? 0) > 0;

        return (
          storeSlug &&
          reviewedStoreSlugs.has(storeSlug) &&
          !purchasedProductIds.has(String(product._id)) &&
          reviewCount > 0 &&
          averageRating >= 4 &&
          inStock
        );
      })
      .sort((left, right) => {
        const leftRating = Number(left?.ratingSummary?.averageRating ?? left?.averageRating ?? 0);
        const rightRating = Number(right?.ratingSummary?.averageRating ?? right?.averageRating ?? 0);
        const leftCount = Number(left?.ratingSummary?.reviewCount ?? left?.reviewCount ?? 0);
        const rightCount = Number(right?.ratingSummary?.reviewCount ?? right?.reviewCount ?? 0);

        if (rightRating !== leftRating) return rightRating - leftRating;
        return rightCount - leftCount;
      })
      .slice(0, 4);
  }, [catalog, orders, reviewInsights]);

  const reviewImpactItems = useMemo(() => {
    return orders
      .flatMap((order) =>
        (order.orderItems || []).map((item) => {
          const insight = getReviewInsight(item.product);
          if (!insight?.userReview) return null;

          const product = catalog.find((entry) => String(entry._id) === String(item.product)) || null;
          const summary = insight?.summary || product?.ratingSummary || {
            averageRating: Number(product?.averageRating || 0),
            reviewCount: Number(product?.reviewCount || 0),
          };

          return {
            orderId: order._id,
            productId: item.product,
            name: item.name || product?.name || 'Reviewed item',
            image: product?.image || item.image || '',
            storeName:
              product?.vendor?.storeName ||
              product?.store?.name ||
              product?.storeName ||
              'Marketplace seller',
            summary,
            userReview: insight.userReview,
            reviewedAt: insight.userReview?.updatedAt || insight.userReview?.createdAt || null,
          };
        })
      )
      .filter(Boolean)
      .sort((left, right) => {
        const leftDate = new Date(left?.userReview?.updatedAt || left?.userReview?.createdAt || 0).getTime();
        const rightDate = new Date(right?.userReview?.updatedAt || right?.userReview?.createdAt || 0).getTime();
        return rightDate - leftDate;
      })
      .slice(0, 4);
  }, [orders, catalog, reviewInsights]);

  const reviewReadyToBuyAgain = useMemo(() => {
    return reviewImpactItems
      .map((item) => {
        const product = catalog.find((entry) => String(entry._id) === String(item.productId)) || null;
        const countInStock = Number(product?.countInStock ?? 0);

        if (!product || countInStock <= 0) return null;

        return {
          ...item,
          price: Number(product?.price || 0),
          countInStock,
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        const leftRating = Number(left?.summary?.averageRating || 0);
        const rightRating = Number(right?.summary?.averageRating || 0);
        if (rightRating !== leftRating) return rightRating - leftRating;
        return Number(right?.summary?.reviewCount || 0) - Number(left?.summary?.reviewCount || 0);
      })
      .slice(0, 4);
  }, [reviewImpactItems, catalog]);

  const trustedCategories = useMemo(() => {
    const buckets = new Map();

    orders.forEach((order) => {
      (order.orderItems || []).forEach((item) => {
        const insight = getReviewInsight(item.product);
        if (!insight?.userReview) return;

        const product = catalog.find((entry) => String(entry._id) === String(item.product)) || null;
        const category =
          product?.category ||
          product?.collection ||
          product?.type ||
          'Marketplace picks';
        const rating = Number(insight.userReview?.rating || 0);

        if (!buckets.has(category)) {
          buckets.set(category, {
            name: category,
            reviewCount: 0,
            ratingTotal: 0,
          });
        }

        const current = buckets.get(category);
        current.reviewCount += 1;
        current.ratingTotal += rating;
      });
    });

    return [...buckets.values()]
      .map((entry) => ({
        ...entry,
        averageRatingGiven: entry.reviewCount ? entry.ratingTotal / entry.reviewCount : 0,
      }))
      .sort((left, right) => {
        if (right.reviewCount !== left.reviewCount) return right.reviewCount - left.reviewCount;
        return right.averageRatingGiven - left.averageRatingGiven;
      })
      .slice(0, 4);
  }, [orders, catalog, reviewInsights]);

  const nextBestShoppingMoves = useMemo(() => {
    const moves = [];

    if (nextReviewTarget) {
      moves.push({
        key: 'review',
        title: 'Finish your next review',
        description: `Share feedback for ${nextReviewTarget.item?.name || 'your delivered item'} and keep your shopper trust growing.`,
      });
    }

    if (reviewReadyToBuyAgain[0]) {
      moves.push({
        key: 'rebuy',
        title: 'Reorder a proven favorite',
        description: `${reviewReadyToBuyAgain[0].name} is still in stock and already earned your trust.`,
        productId: reviewReadyToBuyAgain[0].productId,
      });
    }

    if (trustedCategories[0]) {
      moves.push({
        key: 'category',
        title: 'Browse a trusted category',
        description: `${trustedCategories[0].name} is one of your strongest confidence zones right now.`,
        categoryName: trustedCategories[0].name,
      });
    }

    if (reviewLedStores[0]) {
      moves.push({
        key: 'store',
        title: 'Return to a trusted store',
        description: `${reviewLedStores[0].storeName} is standing out with strong shopper feedback.`,
        storeSlug: reviewLedStores[0].storeSlug,
      });
    }

    return moves.slice(0, 3);
  }, [nextReviewTarget, reviewReadyToBuyAgain, trustedCategories, reviewLedStores]);

  const accountJumpLinks = useMemo(() => {
    const links = [];

    if (reviewReminderItems.length) {
      links.push({
        id: 'review-reminders',
        label: 'Review actions',
        helper: `${reviewReminderItems.length} waiting`,
      });
    }

    if (reviewReadyToBuyAgain.length) {
      links.push({
        id: 'ready-to-order-again',
        label: 'Reorder picks',
        helper: `${reviewReadyToBuyAgain.length} ready`,
      });
    }

    if (reviewImpactItems.length) {
      links.push({
        id: 'review-impact',
        label: 'Your impact',
        helper: `${reviewImpactItems.length} live`,
      });
    }

    if (reviewLedStores.length) {
      links.push({
        id: 'trusted-stores',
        label: 'Trusted stores',
        helper: `${reviewLedStores.length} strong`,
      });
    }

    if (trustedCategories.length) {
      links.push({
        id: 'trusted-categories',
        label: 'Trusted categories',
        helper: `${trustedCategories.length} matched`,
      });
    }

    return links.slice(0, 5);
  }, [reviewReminderItems, reviewReadyToBuyAgain, reviewImpactItems, reviewLedStores, trustedCategories]);

  const shopperActionBar = useMemo(() => {
    if (reviewReminderItems.length && nextReviewTarget) {
      return {
        tone: 'amber',
        title: 'Your next trust action is ready',
        description: `${reviewReminderItems.length} review action${reviewReminderItems.length === 1 ? '' : 's'} still waiting, starting with ${nextReviewTarget.item?.name || 'your next delivered item'}.`,
        cta: 'review',
        label: 'Review now',
      };
    }

    if (reviewReadyToBuyAgain.length) {
      return {
        tone: 'navy',
        title: 'A proven reorder is still in stock',
        description: `${reviewReadyToBuyAgain[0].name} is ready for another easy order.`,
        cta: 'rebuy',
        label: 'View reorder pick',
      };
    }

    if (trustedCategories.length) {
      return {
        tone: 'navy',
        title: 'You already know where to shop with confidence',
        description: `${trustedCategories[0].name} is one of your strongest trusted categories right now.`,
        cta: 'category',
        label: 'Explore category',
      };
    }

    return null;
  }, [reviewReminderItems, nextReviewTarget, reviewReadyToBuyAgain, trustedCategories]);

  const reviewerSnapshot = useMemo(() => {
    const allReviewedEntries = orders
      .flatMap((order) =>
        (order.orderItems || []).map((item) => {
          const insight = getReviewInsight(item.product);
          if (!insight?.userReview) return null;

          const product = catalog.find((entry) => String(entry._id) === String(item.product)) || null;
          const storeName =
            product?.vendor?.storeName ||
            product?.store?.name ||
            product?.storeName ||
            'Marketplace seller';

          return {
            rating: Number(insight.userReview?.rating || 0),
            storeName,
          };
        })
      )
      .filter(Boolean);

    const totalReviews = allReviewedEntries.length;
    const reviewedStores = new Set(allReviewedEntries.map((entry) => entry.storeName)).size;
    const fiveStarCount = allReviewedEntries.filter((entry) => entry.rating === 5).length;
    const averageRatingGiven = totalReviews
      ? allReviewedEntries.reduce((sum, entry) => sum + entry.rating, 0) / totalReviews
      : 0;
    const mostRecentReviewAt = orders
      .flatMap((order) =>
        (order.orderItems || []).map((item) => {
          const insight = getReviewInsight(item.product);
          return insight?.userReview?.updatedAt || insight?.userReview?.createdAt || null;
        })
      )
      .filter(Boolean)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || null;

    return {
      totalReviews,
      reviewedStores,
      fiveStarCount,
      averageRatingGiven,
      mostRecentReviewAt,
    };
  }, [orders, catalog, reviewInsights]);

  const reviewHomecoming = useMemo(() => {
    if (reviewReminderItems.length > 0 && nextReviewTarget) {
      return {
        eyebrow: 'Welcome back',
        title: 'A few trusted shopping actions are still waiting for you',
        description: `You still have ${reviewReminderItems.length} delivered item${reviewReminderItems.length === 1 ? '' : 's'} ready for feedback, starting with ${nextReviewTarget.item?.name || 'your next item'}.`,
        primaryLabel: 'Review next item',
        primaryAction: 'review',
      };
    }

    if (reviewReadyToBuyAgain.length > 0) {
      return {
        eyebrow: 'Welcome back',
        title: 'You already have proven favorites ready to shop again',
        description: `${reviewReadyToBuyAgain[0].name} is still in stock, already reviewed by you, and ready for another easy order.`,
        primaryLabel: 'View reorder pick',
        primaryAction: 'rebuy',
      };
    }

    if (reviewerSnapshot.totalReviews > 0) {
      return {
        eyebrow: 'Trusted shopper',
        title: 'Your feedback is now part of the marketplace buying signal',
        description: `You have shared ${reviewerSnapshot.totalReviews} review${reviewerSnapshot.totalReviews === 1 ? '' : 's'} and helped shoppers discover stronger stores and products.`,
        primaryLabel: 'Browse trusted categories',
        primaryAction: 'category',
      };
    }

    return null;
  }, [reviewReminderItems, nextReviewTarget, reviewReadyToBuyAgain, reviewerSnapshot, trustedCategories]);

  const reviewerSignals = useMemo(() => {
    const entries = orders
      .flatMap((order) =>
        (order.orderItems || []).map((item) => {
          const insight = getReviewInsight(item.product);
          if (!insight?.userReview) return null;

          const product = catalog.find((entry) => String(entry._id) === String(item.product)) || null;
          const storeName =
            product?.vendor?.storeName ||
            product?.store?.name ||
            product?.storeName ||
            'Marketplace seller';

          return {
            rating: Number(insight.userReview?.rating || 0),
            storeName,
          };
        })
      )
      .filter(Boolean);

    const ratingCounts = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: entries.filter((entry) => entry.rating === rating).length,
    }));

    const storeCounts = entries.reduce((acc, entry) => {
      acc[entry.storeName] = (acc[entry.storeName] || 0) + 1;
      return acc;
    }, {});

    const mostReviewedStore = Object.entries(storeCounts)
      .sort((left, right) => right[1] - left[1])[0] || null;

    return {
      ratingCounts,
      mostReviewedStore: mostReviewedStore
        ? { name: mostReviewedStore[0], count: mostReviewedStore[1] }
        : null,
    };
  }, [orders, catalog, reviewInsights]);

  const reviewMomentum = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const entries = orders
      .flatMap((order) =>
        (order.orderItems || []).map((item) => {
          const insight = getReviewInsight(item.product);
          if (!insight?.userReview) return null;

          const product = catalog.find((entry) => String(entry._id) === String(item.product)) || null;
          const storeName =
            product?.vendor?.storeName ||
            product?.store?.name ||
            product?.storeName ||
            'Marketplace seller';

          const reviewedAt = insight.userReview?.updatedAt || insight.userReview?.createdAt || null;
          return reviewedAt ? { reviewedAt, storeName } : null;
        })
      )
      .filter(Boolean);

    const last30Days = entries.filter((entry) => new Date(entry.reviewedAt) >= thirtyDaysAgo);
    const thisMonth = entries.filter((entry) => new Date(entry.reviewedAt) >= monthStart);
    const recentStores = new Set(last30Days.map((entry) => entry.storeName)).size;

    return {
      last30Days: last30Days.length,
      thisMonth: thisMonth.length,
      recentStores,
    };
  }, [orders, catalog, reviewInsights]);

  const reviewStreak = useMemo(() => {
    const timestamps = orders
      .flatMap((order) =>
        (order.orderItems || []).map((item) => {
          const insight = getReviewInsight(item.product);
          return insight?.userReview?.updatedAt || insight?.userReview?.createdAt || null;
        })
      )
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()));

    if (!timestamps.length) {
      return {
        currentMonthStreak: 0,
        activeMonths: 0,
      };
    }

    const monthKeys = new Set(
      timestamps.map((date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    );

    let activeMonths = monthKeys.size;
    let currentMonthStreak = 0;
    let cursor = new Date();

    while (true) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      if (!monthKeys.has(key)) break;
      currentMonthStreak += 1;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
    }

    return {
      currentMonthStreak,
      activeMonths,
    };
  }, [orders, reviewInsights]);

  const reviewComebackNudge = useMemo(() => {
    const lastReviewAt = reviewerSnapshot.mostRecentReviewAt
      ? new Date(reviewerSnapshot.mostRecentReviewAt)
      : null;
    const now = new Date();
    const daysSinceLastReview = lastReviewAt
      ? Math.floor((now.getTime() - lastReviewAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    if (reviewReminderItems.length > 0 && (daysSinceLastReview === null || daysSinceLastReview >= 14) && nextReviewTarget) {
      return {
        title: 'Bring your shopper voice back into the marketplace',
        description: `It has been ${daysSinceLastReview === null ? 'a while' : `${daysSinceLastReview} days`} since your last review. ${nextReviewTarget.item?.name || 'Your next delivered item'} is ready for feedback now.`,
        action: 'review',
        label: 'Make a comeback review',
      };
    }

    if (reviewerSnapshot.totalReviews > 0 && reviewMomentum.last30Days === 0) {
      return {
        title: 'Your trust profile is ready for fresh momentum',
        description: 'A new review this month will wake up your recent activity score and keep your shopper voice visible.',
        action: trustedCategories[0] ? 'category' : 'shop',
        label: trustedCategories[0] ? 'Browse a trusted category' : 'Keep shopping',
      };
    }

    return null;
  }, [reviewerSnapshot, reviewReminderItems, nextReviewTarget, reviewMomentum, trustedCategories]);

  const shopperHabits = useMemo(() => {
    const habits = [];

    if (reviewReadyToBuyAgain.length >= 2) {
      habits.push({
        key: 'reorder',
        title: 'Repeat-value buyer',
        description: 'You tend to return to products that already proved themselves in past orders.',
      });
    }

    if (trustedCategories.length >= 2) {
      habits.push({
        key: 'category',
        title: 'Category loyalist',
        description: 'Your confidence is strongest when you shop inside familiar categories you already reviewed.',
      });
    }

    if (reviewLedStores.length >= 2) {
      habits.push({
        key: 'store',
        title: 'Store-first shopper',
        description: 'You build trust through storefronts and often lean toward sellers you already know well.',
      });
    }

    if (Number(reviewerSnapshot.averageRatingGiven || 0) >= 4.5) {
      habits.push({
        key: 'quality',
        title: 'High-quality spotter',
        description: 'Your reviews show a strong eye for standout products and reliable buying experiences.',
      });
    }

    if (reviewMomentum.thisMonth >= 2 || reviewStreak.currentMonthStreak >= 2) {
      habits.push({
        key: 'active',
        title: 'Momentum shopper',
        description: 'You keep your shopper voice active, which makes your profile feel current and trusted.',
      });
    }

    if (!habits.length) {
      habits.push({
        key: 'emerging',
        title: 'Emerging trusted shopper',
        description: 'Your shopping habits are starting to take shape as you add more reviews and repeat-buying patterns.',
      });
    }

    return habits.slice(0, 4);
  }, [reviewReadyToBuyAgain, trustedCategories, reviewLedStores, reviewerSnapshot, reviewMomentum, reviewStreak]);

  const shoppingLaneCatalog = useMemo(() => {
    const lanes = [];

    if (reviewReadyToBuyAgain.length >= 2) {
      lanes.push({
        key: 'rebuy',
        tone: 'navy',
        title: 'Best shopping lane for you: reorder with confidence',
        description: 'Your account shows strong repeat-buying confidence, so the fastest path is to revisit proven products that are still in stock.',
        cta: 'rebuy',
        label: 'Open reorder picks',
        helper: `${reviewReadyToBuyAgain.length} reorder-ready item${reviewReadyToBuyAgain.length === 1 ? '' : 's'}`,
      });
    }

    if (reviewLedStores.length >= 2) {
      lanes.push({
        key: 'store',
        tone: 'navy',
        title: 'Best shopping lane for you: trusted stores first',
        description: 'You tend to build confidence through storefronts, so browsing stores you already trust is likely to feel easiest and strongest.',
        cta: 'store',
        label: 'Visit trusted store',
        helper: `${reviewLedStores.length} trusted store${reviewLedStores.length === 1 ? '' : 's'}`,
      });
    }

    if (trustedCategories.length >= 2) {
      lanes.push({
        key: 'category',
        tone: 'navy',
        title: 'Best shopping lane for you: stay inside trusted categories',
        description: 'Your review history shows clear category confidence, making this the simplest way to keep shopping with low friction.',
        cta: 'category',
        label: 'Explore trusted category',
        helper: `${trustedCategories.length} trusted categor${trustedCategories.length === 1 ? 'y' : 'ies'}`,
      });
    }

    if (nextReviewTarget) {
      lanes.push({
        key: 'review',
        tone: 'amber',
        title: 'Best shopping lane for you: finish the next trust action',
        description: 'A quick review on your next delivered item will strengthen your trust profile and unlock clearer recommendations.',
        cta: 'review',
        label: 'Review next item',
        helper: `${reviewReminderItems.length} open review action${reviewReminderItems.length === 1 ? '' : 's'}`,
      });
    }

    return lanes;
  }, [reviewReadyToBuyAgain, reviewLedStores, trustedCategories, nextReviewTarget, reviewReminderItems]);

  const bestShoppingLane = useMemo(() => {
    if (!shoppingLaneCatalog.length) return null;
    return (
      shoppingLaneCatalog.find((lane) => lane.key === selectedLaneKey) ||
      shoppingLaneCatalog[0]
    );
  }, [shoppingLaneCatalog, selectedLaneKey]);

  const recommendedShoppingLane = shoppingLaneCatalog[0] || null;
  const isUsingCustomLane =
    Boolean(selectedLaneKey) &&
    Boolean(bestShoppingLane) &&
    Boolean(recommendedShoppingLane) &&
    bestShoppingLane.key !== recommendedShoppingLane.key;

  const bestShoppingLaneReasons = useMemo(() => {
    if (!bestShoppingLane) return [];

    if (bestShoppingLane.cta === 'rebuy') {
      return [
        'You already reviewed these products, so the buying risk feels lower.',
        'These picks are still in stock, making the path back to checkout much faster.',
        'Your reorder history suggests confidence grows when a product has already proved itself.',
      ];
    }

    if (bestShoppingLane.cta === 'store') {
      return [
        'Your reviews show that trust often builds around familiar storefronts.',
        'Strong store confidence usually leads to easier repeat buying and better discovery.',
        'Browsing trusted sellers first reduces friction when choosing your next item.',
      ];
    }

    if (bestShoppingLane.cta === 'category') {
      return [
        'Your review history already reveals categories where your confidence is strongest.',
        'Shopping inside known categories usually creates faster, easier decisions.',
        'These categories carry the clearest trust signal in your current account profile.',
      ];
    }

    return [
      'Your next delivered item is still waiting for feedback.',
      'Finishing this review strengthens your trust profile and future recommendations.',
      'A quick review now can unlock stronger shopper signals across the rest of your account.',
    ];
  }, [bestShoppingLane]);

  const bestShoppingLaneConfidence = useMemo(() => {
    if (!bestShoppingLane) return null;

    if (bestShoppingLane.cta === 'rebuy') {
      const score = Math.min(
        92,
        55 +
          reviewReadyToBuyAgain.length * 10 +
          Math.min(reviewImpactItems.length, 3) * 5
      );

      return {
        score,
        label: score >= 80 ? 'Very strong fit' : 'Strong fit',
      };
    }

    if (bestShoppingLane.cta === 'store') {
      const score = Math.min(
        89,
        50 +
          reviewLedStores.length * 12 +
          Math.min(reviewerSnapshot.reviewedStores, 3) * 4
      );

      return {
        score,
        label: score >= 80 ? 'Very strong fit' : 'Strong fit',
      };
    }

    if (bestShoppingLane.cta === 'category') {
      const score = Math.min(
        86,
        48 +
          trustedCategories.length * 12 +
          Math.min(reviewerSnapshot.totalReviews, 5) * 3
      );

      return {
        score,
        label: score >= 75 ? 'Strong fit' : 'Good fit',
      };
    }

    const score = Math.min(
      84,
      46 +
        Math.min(reviewReminderItems.length, 4) * 8 +
        (nextReviewTarget ? 8 : 0)
    );

    return {
      score,
      label: score >= 75 ? 'Strong fit' : 'Good fit',
    };
  }, [
    bestShoppingLane,
    reviewReadyToBuyAgain,
    reviewImpactItems,
    reviewLedStores,
    reviewerSnapshot,
    trustedCategories,
    reviewReminderItems,
    nextReviewTarget,
  ]);

  const alternativeShoppingLanes = useMemo(() => {
    if (!bestShoppingLane) return [];
    return shoppingLaneCatalog
      .filter((lane) => lane.key !== bestShoppingLane.key)
      .map((lane) => {
        if (lane.key === 'review') {
          return {
            key: 'review',
            title: 'Keep trust growing',
            description: `${nextReviewTarget?.item?.name || 'Your next delivered item'} is still waiting for feedback.`,
            label: 'Review next item',
          };
        }

        if (lane.key === 'rebuy') {
          return {
            key: 'rebuy',
            title: 'Return to a proven product',
            description: `${reviewReadyToBuyAgain[0]?.name || 'A trusted product'} is still in stock and already earned your confidence.`,
            label: 'View reorder pick',
          };
        }

        if (lane.key === 'store') {
          return {
            key: 'store',
            title: 'Shop from a trusted store',
            description: `${reviewLedStores[0]?.storeName || 'A trusted store'} keeps standing out in your trust profile.`,
            label: 'Visit trusted store',
          };
        }

        return {
          key: 'category',
          title: 'Stay inside a trusted category',
          description: `${trustedCategories[0]?.name || 'A trusted category'} remains one of your easiest paths to buy with confidence.`,
          label: 'Explore category',
        };
      })
      .slice(0, 2);
  }, [bestShoppingLane, shoppingLaneCatalog, nextReviewTarget, reviewReadyToBuyAgain, reviewLedStores, trustedCategories]);

  const recentLaneHistory = useMemo(() => {
    return laneHistoryKeys
      .map((key) => shoppingLaneCatalog.find((lane) => lane.key === key))
      .filter(Boolean)
      .slice(0, 3);
  }, [laneHistoryKeys, shoppingLaneCatalog]);

  const laneFreshnessHint = useMemo(() => {
    if (!bestShoppingLane) return null;

    if (isUsingCustomLane) {
      return 'You are currently browsing with your saved lane preference, not the default recommendation.';
    }

    if (recentLaneHistory.length > 0) {
      return 'This is the live recommended lane for your current shopper profile.';
    }

    return 'This recommendation is generated from your latest reviews, reorder signals, and trusted categories.';
  }, [bestShoppingLane, isUsingCustomLane, recentLaneHistory]);

  const reviewerAchievements = useMemo(() => {
    const achievements = [];

    if (reviewerSnapshot.totalReviews >= 1) {
      achievements.push({
        key: 'first-review',
        title: 'First review shared',
        description: 'You have already helped at least one future shopper choose with confidence.',
      });
    }

    if (reviewerSnapshot.totalReviews >= 5) {
      achievements.push({
        key: 'trusted-voice',
        title: 'Trusted voice',
        description: 'Your feedback now spans multiple products and carries more marketplace weight.',
      });
    }

    if (reviewerSnapshot.reviewedStores >= 3) {
      achievements.push({
        key: 'store-builder',
        title: 'Store builder',
        description: 'You have strengthened trust across several storefronts, not just one.',
      });
    }

    if (reviewerSnapshot.fiveStarCount >= 3) {
      achievements.push({
        key: 'quality-spotter',
        title: 'Quality spotter',
        description: 'You consistently recognize standout orders and surface them for other shoppers.',
      });
    }

    if (reviewMomentum.thisMonth >= 2) {
      achievements.push({
        key: 'active-this-month',
        title: 'Active this month',
        description: 'Your recent feedback is still shaping how shoppers buy right now.',
      });
    }

    return achievements.slice(0, 4);
  }, [reviewerSnapshot, reviewMomentum]);

  const reviewerTrustScore = useMemo(() => {
    const totalReviewsScore = Math.min(reviewerSnapshot.totalReviews * 8, 40);
    const storeReachScore = Math.min(reviewerSnapshot.reviewedStores * 8, 20);
    const recentActivityScore = Math.min(reviewMomentum.last30Days * 6, 18);
    const consistencyScore = Math.min(Math.round(reviewerSnapshot.averageRatingGiven * 4), 12);
    const qualitySpottingScore = Math.min(reviewerSnapshot.fiveStarCount * 2, 10);

    const score = totalReviewsScore + storeReachScore + recentActivityScore + consistencyScore + qualitySpottingScore;
    const components = [
      {
        key: 'reviews',
        label: 'Reviews shared',
        score: totalReviewsScore,
        max: 40,
      },
      {
        key: 'stores',
        label: 'Store reach',
        score: storeReachScore,
        max: 20,
      },
      {
        key: 'recent',
        label: 'Recent activity',
        score: recentActivityScore,
        max: 18,
      },
      {
        key: 'consistency',
        label: 'Rating consistency',
        score: consistencyScore,
        max: 12,
      },
      {
        key: 'quality',
        label: 'Quality spotting',
        score: qualitySpottingScore,
        max: 10,
      },
    ];

    const buildTier = (label, description, min, max, nextLabel = null) => ({
      score,
      components,
      label,
      description,
      min,
      max,
      nextLabel,
      remainingToNext: nextLabel ? Math.max(max - score, 0) : 0,
      progressInTier: Math.max(0, Math.min(100, Math.round(((score - min) / Math.max(max - min, 1)) * 100))),
    });

    if (score >= 80) {
      return buildTier(
        'Marketplace guide',
        'Your shopper voice is now one of the strongest trust signals in this marketplace.',
        80,
        100,
        null
      );
    }

    if (score >= 55) {
      return buildTier(
        'Trusted shopper',
        'Your feedback is consistently helping other shoppers buy with more confidence.',
        55,
        80,
        'Marketplace guide'
      );
    }

    if (score >= 30) {
      return buildTier(
        'Growing reviewer',
        'Your review history is gaining momentum and starting to shape store trust.',
        30,
        55,
        'Trusted shopper'
      );
    }

    return buildTier(
      'Early reviewer',
      'A few more helpful reviews will quickly strengthen your marketplace footprint.',
      0,
      30,
      'Growing reviewer'
    );
  }, [reviewerSnapshot, reviewMomentum]);

  const trustScoreHint = useMemo(() => {
    const weakestComponent = [...reviewerTrustScore.components].sort((left, right) => {
      const leftRatio = left.max ? left.score / left.max : 0;
      const rightRatio = right.max ? right.score / right.max : 0;
      return leftRatio - rightRatio;
    })[0];

    if (!weakestComponent) return null;

    if (weakestComponent.key === 'reviews') {
      return 'Sharing more delivered-order reviews is the fastest way to grow your trust score right now.';
    }

    if (weakestComponent.key === 'stores') {
      return 'Reviewing orders from more storefronts will increase your marketplace reach fastest.';
    }

    if (weakestComponent.key === 'recent') {
      return 'Your score will climb faster when you keep recent review activity active this month.';
    }

    if (weakestComponent.key === 'consistency') {
      return 'Clear, steady ratings across delivered orders will strengthen your consistency signal.';
    }

    return 'Spotting standout orders and rating them clearly will keep pushing your trust score upward.';
  }, [reviewerTrustScore]);

  const personalShopperSummary = useMemo(() => {
    if (reviewReminderItems.length > 0 && nextReviewTarget) {
      return `You are building trust steadily, with ${reviewReminderItems.length} more review action${reviewReminderItems.length === 1 ? '' : 's'} ready to strengthen your shopper voice.`;
    }

    if (reviewReadyToBuyAgain.length > 0) {
      return `You shop with confidence and already have proven favorites ready for another order whenever you are.`;
    }

    if (reviewerTrustScore.label === 'Marketplace guide') {
      return 'You are now one of the marketplace’s strongest shopper voices, helping others choose better products and stores.';
    }

    if (reviewerTrustScore.label === 'Trusted shopper') {
      return 'Your reviews are now a reliable trust signal across products, stores, and repeat-buying decisions.';
    }

    if (reviewerTrustScore.label === 'Growing reviewer') {
      return 'Your review history is gaining momentum and turning your account into a stronger shopping guide.';
    }

    return 'You are laying the foundation for a trusted shopping profile with every order you review.';
  }, [reviewReminderItems, nextReviewTarget, reviewReadyToBuyAgain, reviewerTrustScore]);

  const shopperPersonaTag = useMemo(() => {
    if (reviewerTrustScore.label === 'Marketplace guide') {
      return 'Marketplace guide';
    }

    if (reviewReadyToBuyAgain.length >= 2) {
      return 'Confident repeat buyer';
    }

    if (reviewReminderItems.length >= 2) {
      return 'Active trust builder';
    }

    if (reviewLedStores.length >= 2) {
      return 'Store-savvy shopper';
    }

    if (trustedCategories.length >= 2) {
      return 'Category-driven shopper';
    }

    if (reviewerTrustScore.label === 'Trusted shopper') {
      return 'Trusted shopper';
    }

    if (reviewerTrustScore.label === 'Growing reviewer') {
      return 'Growing reviewer';
    }

    return 'Early reviewer';
  }, [reviewerTrustScore, reviewReadyToBuyAgain, reviewReminderItems, reviewLedStores, trustedCategories]);

  const shopperStrengths = useMemo(() => {
    const strengths = [];

    if (reviewerSnapshot.totalReviews >= 3) {
      strengths.push('You consistently turn completed orders into useful buyer guidance.');
    }

    if (reviewLedStores.length >= 2) {
      strengths.push('You help surface trustworthy stores, not just individual products.');
    }

    if (reviewReadyToBuyAgain.length >= 1) {
      strengths.push('You know how to spot products worth buying again with confidence.');
    }

    if (trustedCategories.length >= 2) {
      strengths.push('Your feedback already reveals clear confidence zones across categories.');
    }

    if (reviewMomentum.last30Days >= 2) {
      strengths.push('Your recent activity keeps your shopper voice fresh and relevant.');
    }

    if (!strengths.length) {
      strengths.push('Each delivered-order review you share is building a stronger shopping profile.');
    }

    return strengths.slice(0, 3);
  }, [reviewerSnapshot, reviewLedStores, reviewReadyToBuyAgain, trustedCategories, reviewMomentum]);

  const shopperGrowthAreas = useMemo(() => {
    const areas = [];

    if (reviewReminderItems.length > 0) {
      areas.push('Finish more delivered-order reviews to turn completed purchases into trust signals.');
    }

    if (reviewLedStores.length < 2) {
      areas.push('Review items from more storefronts to widen your store trust reach.');
    }

    if (trustedCategories.length < 2) {
      areas.push('Explore and review more categories to build a broader shopping confidence profile.');
    }

    if (reviewMomentum.last30Days < 2) {
      areas.push('Keeping recent review activity going will strengthen your score faster this month.');
    }

    if (!areas.length) {
      areas.push('You are covering the key trust areas well. Keep sharing timely reviews to stay at the top.');
    }

    return areas.slice(0, 3);
  }, [reviewReminderItems, reviewLedStores, trustedCategories, reviewMomentum]);

  const reviewerMilestone = useMemo(() => {
    const totalReviews = reviewerSnapshot.totalReviews;

    if (!totalReviews) {
      return {
        title: 'Getting started',
        nextTarget: 3,
        progressLabel: 'Share your first trusted product review',
      };
    }

    if (totalReviews < 3) {
      return {
        title: 'New reviewer',
        nextTarget: 3,
        progressLabel: 'Reach 3 reviews to become a trusted voice',
      };
    }

    if (totalReviews < 10) {
      return {
        title: 'Trusted voice',
        nextTarget: 10,
        progressLabel: 'Reach 10 reviews to unlock marketplace guide status',
      };
    }

    return {
      title: 'Marketplace guide',
      nextTarget: totalReviews,
      progressLabel: 'You are already one of the strongest shopper voices here',
    };
  }, [reviewerSnapshot]);

  const reviewerMilestoneProgress = useMemo(() => {
    const totalReviews = reviewerSnapshot.totalReviews;
    const nextTarget = reviewerMilestone.nextTarget;

    if (!nextTarget) return 0;
    if (totalReviews >= nextTarget) return 100;

    const previousTarget = nextTarget === 3 ? 0 : nextTarget === 10 ? 3 : 0;
    const span = Math.max(nextTarget - previousTarget, 1);
    const completed = Math.max(totalReviews - previousTarget, 0);

    return Math.max(0, Math.min(100, Math.round((completed / span) * 100)));
  }, [reviewerSnapshot, reviewerMilestone]);

  const reviewerMilestoneNudge = useMemo(() => {
    const totalReviews = reviewerSnapshot.totalReviews;
    const nextTarget = reviewerMilestone.nextTarget;

    if (!nextTarget || totalReviews >= nextTarget) {
      return {
        headline: 'You are already setting the pace for trusted shopping.',
        detail: 'Keep sharing honest feedback whenever an order stands out.',
      };
    }

    const remaining = Math.max(nextTarget - totalReviews, 0);
    const nextTitle = nextTarget === 3 ? 'Trusted voice' : 'Marketplace guide';

    return {
      headline: `${remaining} more review${remaining === 1 ? '' : 's'} to reach ${nextTitle}`,
      detail: 'Each delivered-order review strengthens store confidence and helps future shoppers choose faster.',
    };
  }, [reviewerSnapshot, reviewerMilestone]);

  const getReviewInsight = (productId) => reviewInsights[String(productId)] || null;

  const openReviewModal = (item, insight = null) => {
    const product = catalog.find((entry) => String(entry._id) === String(item.product)) || null;
    const existingReview = insight?.userReview || null;
    setActiveReview({
      productId: item.product,
      orderItem: item,
      product,
      insight,
      rating: existingReview?.rating || 5,
      title: existingReview?.title || '',
      comment: existingReview?.comment || '',
      hasExistingReview: Boolean(existingReview),
      justSubmitted: false,
    });
  };

  const closeReviewModal = () => {
    if (reviewSubmitting) return;
    setActiveReview(null);
  };

  const chooseShoppingLane = (laneKey) => {
    setSelectedLaneKey(laneKey || '');

    if (!laneKey) return;

    setLaneHistoryKeys((current) => [laneKey, ...current.filter((entry) => entry !== laneKey)].slice(0, 4));
  };

  const getProductPath = (value) => {
    if (!value) return '/shop';

    if (typeof value === 'string' || typeof value === 'number') {
      return `/product/${value}`;
    }

    const resolvedId =
      value?._id ||
      value?.id ||
      value?.productId ||
      value?.product ||
      '';

    return resolvedId ? `/product/${resolvedId}` : '/shop';
  };

  const refreshReviewInsight = async (productId) => {
    const { data } = await axiosPrivate.get(`/products/${productId}/reviews`);
    const nextInsight = {
      summary: data?.ratingSummary || data?.summary || null,
      userReview: data?.userReview || null,
      reviewEligibility: data?.reviewEligibility || null,
      reviews: Array.isArray(data?.reviews) ? data.reviews : [],
    };

    setReviewInsights((current) => ({
      ...current,
      [String(productId)]: nextInsight,
    }));

    const nextSummary = nextInsight.summary || null;
    if (nextSummary) {
      setCatalog((current) =>
        current.map((entry) =>
          String(entry._id) === String(productId)
            ? {
                ...entry,
                averageRating: nextSummary.averageRating ?? entry.averageRating ?? 0,
                reviewCount: nextSummary.reviewCount ?? entry.reviewCount ?? 0,
                ratingSummary: nextSummary,
              }
            : entry
        )
      );
    }

    return nextInsight;
  };

  const submitQuickReview = async (event) => {
    event.preventDefault();
    if (!activeReview || reviewSubmitting) return;

    const rating = Number(activeReview.rating || 0);
    if (!rating || rating < 1 || rating > 5) {
      toast.error('Choose a star rating before sharing your review.');
      return;
    }

    setReviewSubmitting(true);
    try {
      await axiosPrivate.post(`/products/${activeReview.productId}/reviews`, {
        rating,
        title: activeReview.title?.trim() || '',
        comment: activeReview.comment?.trim() || '',
      });

      const nextInsight = await refreshReviewInsight(activeReview.productId);
      toast.success(activeReview.hasExistingReview ? 'Your review has been updated.' : 'Thanks for sharing your review.');
      setReviewCelebration({
        productId: activeReview.productId,
        productName:
          activeReview?.product?.name ||
          activeReview?.orderItem?.name ||
          'Your item',
        storeSlug:
          activeReview?.product?.vendor?.storeSlug ||
          activeReview?.product?.store?.slug ||
          activeReview?.product?.storeSlug ||
          '',
        storeName:
          activeReview?.product?.vendor?.storeName ||
          activeReview?.product?.store?.name ||
          activeReview?.product?.storeName ||
          '',
        averageRating: Number(nextInsight?.summary?.averageRating || 0),
        reviewCount: Number(nextInsight?.summary?.reviewCount || 0),
      });
      setActiveReview((current) =>
        current
          ? {
              ...current,
              insight: nextInsight,
              hasExistingReview: true,
              justSubmitted: true,
            }
          : current
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || 'We could not save your review right now.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f0fdf4_32%,#fff7ed_100%)] px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[32px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#ffffff_0%,#eff6ff_48%,#fff7ed_100%)] p-6 shadow-[0_24px_50px_rgba(15,23,42,0.08)]"
        >
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Customer account</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Welcome back, {profile.name || user?.name || "shopper"}.</h1>
              <p className="mt-3 max-w-2xl text-slate-600">Track orders, refresh mobile money payments, manage your contact details, and keep an eye on store updates in one clean account view.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Orders placed" value={orderStats.totalOrders} />
              <SummaryCard label="Awaiting payment" value={orderStats.awaitingPayment} />
              <SummaryCard label="Payments confirmed" value={orderStats.paidOrders} />
              <SummaryCard label="Delivered" value={orderStats.deliveredOrders} />
            </div>
          </div>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 }}
              className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.05)]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 text-[#102A43]">
                  <FiUser size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Profile</p>
                  <h2 className="mt-1 text-lg font-black text-slate-900">Your shopper details</h2>
                </div>
              </div>

              <form className="mt-5 space-y-4" onSubmit={handleProfileSubmit}>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Full name</span>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#102A43]/35 focus:ring-2 focus:ring-orange-100"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Email address</span>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#102A43]/35 focus:ring-2 focus:ring-orange-100"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Mobile phone</span>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="07xxxxxxxx"
                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#102A43]/35 focus:ring-2 focus:ring-orange-100"
                  />
                </label>

                <button
                  type="submit"
                  disabled={profileBusy}
                  className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#10b981_0%,#0f766e_100%)] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiEdit3 /> {profileBusy ? "Saving..." : "Save details"}
                </button>
              </form>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.05)]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-orange-50 p-3 text-orange-600">
                  <FiMapPin size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Quick snapshot</p>
                  <h2 className="mt-1 text-lg font-black text-slate-900">Where we reach you</h2>
                </div>
              </div>

              <div className="mt-5 space-y-4 text-sm text-slate-600">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Preferred phone</p>
                  <p className="mt-2 flex items-center gap-2 font-semibold text-slate-900"><FiPhone /> {latestContactPhone}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Account created</p>
                  <p className="mt-2 font-semibold text-slate-900">{joinedAtLabel}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Latest delivery address</p>
                  <p className="mt-2 font-semibold text-slate-900">{latestDeliveryAddress}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Total spend</p>
                  <p className="mt-2 text-xl font-black text-[#102A43]">TZS {Number(orderStats.spent || 0).toLocaleString()}</p>
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.05)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Saved products</p>
                  <h2 id="wishlist" className="mt-1 text-lg font-black text-slate-900">Your wishlist</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">
                    {savedProducts.length} saved
                  </div>
                  <button
                    type="button"
                    onClick={handleWishlistAddAllToCart}
                    disabled={!savedProducts.some((product) => Number(product.countInStock || 0) > 0)}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#10b981_0%,#0f766e_100%)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FiShoppingBag /> Add all ready now
                  </button>
                </div>
              </div>
              {syncingSavedProducts ? (
                <p className="mt-3 text-xs font-medium text-slate-500">Syncing saved items with your account...</p>
              ) : null}

              <div className="mt-5 space-y-3">
                {savedProducts.length ? savedProducts.slice(0, 4).map((product) => (
                  <div key={product._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-3">
                      <img src={product.image} alt={product.name} className="h-16 w-16 rounded-2xl object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">{product.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{product.vendor?.name || "Marketplace seller"}</p>
                        <div className="mt-2">
                          <MarketplaceRating
                            averageRating={product.averageRating}
                            reviewCount={product.reviewCount}
                            compact
                          />
                        </div>
                        <p className="mt-1 text-sm font-bold text-[#102A43]">TZS {Number(product.price || 0).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                      <span className={`rounded-full px-3 py-1 font-semibold ${Number(product.countInStock || 0) > 0 ? "bg-slate-100 text-[#102A43]" : "bg-slate-200 text-slate-500"}`}>
                        {Number(product.countInStock || 0) > 0 ? `${Number(product.countInStock || 0)} ready now` : "Currently unavailable"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link to={`/product/${product._id}`} className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">
                        View product
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleWishlistAddToCart(product)}
                        disabled={Number(product.countInStock || 0) <= 0}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#10b981_0%,#0f766e_100%)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FiShoppingBag /> Add to cart
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSavedProduct(product._id)}
                        className="inline-flex items-center justify-center rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-slate-500">
                    Products you save for later will appear here.
                  </div>
                )}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.05)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Favorite stores</p>
                  <h2 className="mt-1 text-lg font-black text-slate-900">Your seller shortcuts</h2>
                </div>
                <div className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">
                  {favoriteStoreCount} saved
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {favoriteStoreCards.length ? favoriteStoreCards.slice(0, 4).map((store) => (
                  <div key={store.slug} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-3">
                      <img src={store.sampleImage} alt={store.name} className="h-16 w-16 rounded-2xl object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">{store.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{store.inStockCount || 0} ready now across {store.itemCount || 0} live product{Number(store.itemCount || 0) === 1 ? "" : "s"}</p>
                        <div className="mt-2">
                          <MarketplaceRating
                            averageRating={store.averageRating}
                            reviewCount={store.reviewCount}
                            compact
                          />
                        </div>
                        {Number(store.startingPrice || 0) > 0 ? (
                          <p className="mt-1 text-sm font-bold text-[#102A43]">Starts from TZS {Number(store.startingPrice || 0).toLocaleString()}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link to={`/stores/${store.slug}`} className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">
                        Visit store
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRemoveFavoriteStore(store)}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                      >
                        <FiHeart /> Remove
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-slate-500">
                    Stores you save from seller pages and marketplace highlights will appear here.
                  </div>
                )}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.05)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Recently viewed</p>
                  <h2 className="mt-1 text-lg font-black text-slate-900">Keep shopping where you left off</h2>
                </div>
                <button
                  type="button"
                  onClick={clearRecentProducts}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-900"
                >
                  Clear
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {recentProducts.length ? recentProducts.slice(0, 4).map((product) => {
                  const saved = isSavedProduct(product._id);

                  return (
                    <div key={product._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-[#102A43]/15 hover:bg-white">
                      <div className="flex items-center gap-3">
                        <Link to={`/product/${product._id}`} className="block shrink-0">
                          <img src={product.image} alt={product.name} className="h-16 w-16 rounded-2xl object-cover" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link to={`/product/${product._id}`} className="block truncate font-semibold text-slate-900 hover:text-[#102A43]">
                            {product.name}
                          </Link>
                          <p className="mt-1 text-sm text-slate-500">{product.vendor?.name || "Marketplace seller"}</p>
                          <div className="mt-2">
                            <MarketplaceRating
                              averageRating={product.averageRating}
                              reviewCount={product.reviewCount}
                              compact
                            />
                          </div>
                          <p className="mt-1 text-sm font-bold text-[#102A43]">TZS {Number(product.price || 0).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link to={`/product/${product._id}`} className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">
                          View product
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleRecentToggleSaved(product)}
                          className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                            saved
                              ? "border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <FiHeart /> {saved ? "Saved" : "Save"}
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-slate-500">
                    Products you open will appear here for quick return visits.
                  </div>
                )}
              </div>
            </motion.section>

            {continueShoppingProducts.length ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14 }}
              >
                <RecommendationShelf
                  title="Continue shopping for you"
                  subtitle="A few more marketplace picks based on what you saved, viewed, or bought recently."
                  products={continueShoppingProducts}
                  onAddToCart={handleAccountRecommendationAddToCart}
                  onToggleSaved={handleAccountRecommendationToggleSaved}
                  isSavedProduct={isSavedProduct}
                  getCartQuantity={getCartQuantity}
                  getReasonLabel={(product) => getRecommendationReason({ product, anchors: accountRecommendationAnchors })}
                  emptyMessage="More personalized picks will appear here as your account activity grows."
                />
              </motion.div>
            ) : null}

            {topRatedAccountProducts.length ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
              >
                <RecommendationShelf
                  title="Top rated for your next order"
                  subtitle="These shopper-backed picks are earning the strongest ratings across the marketplace right now."
                  products={topRatedAccountProducts}
                  onAddToCart={handleAccountRecommendationAddToCart}
                  onToggleSaved={handleAccountRecommendationToggleSaved}
                  isSavedProduct={isSavedProduct}
                  getCartQuantity={getCartQuantity}
                  getReasonLabel={(product) =>
                    `${Number(product.averageRating || 0).toFixed(1)} stars from ${Number(product.reviewCount || 0)} shopper review${Number(product.reviewCount || 0) === 1 ? "" : "s"}`
                  }
                  emptyMessage="Top-rated products will appear here once shopper reviews build up."
                />
              </motion.div>
            ) : null}
          </div>

          <div className="space-y-6">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.05)]"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <FiBell className="text-slate-500" />
                    <h2 className="text-lg font-black text-slate-900">Recent updates</h2>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Unread updates also refresh your account automatically while active orders are in progress.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => notificationPreferences.setSoundEnabled(!notificationPreferences.soundEnabled)}
                    className={`rounded-full border px-3 py-1 ${
                      notificationPreferences.soundEnabled
                        ? "border-orange-300 bg-orange-50 text-orange-700"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    Sound {notificationPreferences.soundEnabled ? "On" : "Off"}
                  </button>
                  <button
                    type="button"
                    onClick={() => notificationPreferences.setVibrationEnabled(!notificationPreferences.vibrationEnabled)}
                    className={`rounded-full border px-3 py-1 ${
                      notificationPreferences.vibrationEnabled
                        ? "border-orange-300 bg-orange-50 text-orange-700"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    Vibration {notificationPreferences.vibrationEnabled ? "On" : "Off"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      fetchNotifications();
                      fetchOrders();
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-50"
                  >
                    <FiRefreshCw /> Refresh
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {notifications.length > 0 ? notifications.slice(0, 5).map((notification) => (
                  <div
                    key={notification._id}
                    className={`rounded-2xl border px-4 py-4 ${
                      notification.read
                        ? "border-slate-200 bg-slate-50"
                        : "border-orange-200 bg-orange-50"
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {notification.orderId ? `Order #${String(notification.orderId).slice(-6)}` : "Store update"}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
                        <p className="mt-2 text-xs text-slate-400">
                          {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : "Just now"}
                        </p>
                      </div>

                      {!notification.read ? (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(notification._id)}
                          className="inline-flex items-center gap-2 rounded-full border border-orange-300 bg-white px-3 py-2 text-sm font-medium text-orange-700"
                        >
                          <FiCheck /> Mark as read
                        </button>
                      ) : (
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Read</span>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-slate-500">
                    No updates yet. Your next order change will appear here.
                  </div>
                )}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.05)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Order history</p>
                    <h2 className="mt-1 text-lg font-black text-slate-900">Stay close to every order</h2>
                    <p className="mt-2 max-w-2xl text-sm text-slate-500">From payment approval to delivery arrival, each card below now shows the order journey, the latest payment snapshot, and the next step to expect.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700">
                      {orderStats.awaitingPayment} awaiting payment
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-[#102A43]">
                      {orderStats.movingOrders} moving through fulfillment
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-[#102A43]">
                      {orderStats.deliveredOrders} delivered
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-[24px] border border-amber-100 bg-[linear-gradient(135deg,#fffaf0_0%,#fff7ed_100%)] px-4 py-4 text-sm text-slate-600">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Before payment clears</p>
                    <p className="mt-2">Approve the mobile money prompt on your phone, then use the card action to refresh the result if needed.</p>
                  </div>
                  <div className="rounded-[24px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_100%)] px-4 py-4 text-sm text-slate-600">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#102A43]">While we prepare delivery</p>
                    <p className="mt-2">Once payment is confirmed, keep an eye on the journey row for packing and delivery progress.</p>
                  </div>
                  <div className="rounded-[24px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#fff7ed_100%)] px-4 py-4 text-sm text-slate-600">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#102A43]">While your order is active</p>
                    <p className="mt-2">Pending mobile money orders still refresh automatically every 15 seconds while a payment or delivery update is in motion.</p>
                  </div>
                </div>
              </div>

              {reviewPromptSummary.total > 0 ? (
                <div className="rounded-[28px] border border-amber-200 bg-[linear-gradient(135deg,#fffaf0_0%,#f8fafc_100%)] p-5 shadow-[0_18px_35px_rgba(15,23,42,0.05)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">Shopper feedback</p>
                      <h3 className="mt-1 text-lg font-black text-slate-900">Delivered items ready for review</h3>
                      <p className="mt-2 max-w-2xl text-sm text-slate-600">
                        Share feedback from delivered orders so the next shopper can buy with more confidence.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700">
                        {reviewPromptSummary.pending} waiting for your review
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-[#102A43]">
                        {reviewPromptSummary.completed} already reviewed
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {recentReorder ? (
                <div className="rounded-[28px] border border-[#102A43]/10 bg-[linear-gradient(135deg,#eff6ff_0%,#fff7ed_100%)] p-5 shadow-[0_16px_30px_rgba(15,23,42,0.10)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#102A43]">Ready to check out again</p>
                      <h3 className="mt-1 text-lg font-black text-slate-900">Items from order #{String(recentReorder.orderId || "").slice(-6)} are now in your cart</h3>
                      <p className="mt-2 text-sm text-slate-600">{recentReorder.addedLines} item {recentReorder.addedLines === 1 ? "line" : "lines"} added back to your cart{recentReorder.skippedLines ? `, while ${recentReorder.skippedLines} ${recentReorder.skippedLines === 1 ? "line is" : "lines are"} unavailable right now.` : "."}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link to="/cart" className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#102A43_0%,#081B2E_100%)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5">
                        <FiShoppingBag /> Review cart
                      </Link>
                      <Link to="/shop" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                        Keep shopping
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {recentReorder.products.slice(0, 4).map((product) => (
                      <span key={product._id} className="rounded-full border border-white/80 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                        {product.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {reorderRecommendations.length ? (
                <RecommendationShelf
                  title="Complete this order again"
                  subtitle="A few more marketplace picks that fit the items you just sent back to cart."
                  products={reorderRecommendations}
                  onAddToCart={handleAccountRecommendationAddToCart}
                  onToggleSaved={handleAccountRecommendationToggleSaved}
                  isSavedProduct={isSavedProduct}
                  getCartQuantity={getCartQuantity}
                  getReasonLabel={(product) => getRecommendationReason({ product, anchors: reorderRecommendationAnchors })}
                  emptyMessage=""
                />
              ) : null}

          {reviewCelebration ? (
            <section className="mb-6 overflow-hidden rounded-[2rem] border border-[#102A43]/10 bg-gradient-to-r from-slate-100 via-white to-orange-50 px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.10)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#102A43]">
                    Review saved
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    Your feedback for {reviewCelebration.productName} is now helping other shoppers
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    This item now shows a shopper signal of {reviewCelebration.averageRating.toFixed(1)} stars across{' '}
                    {reviewCelebration.reviewCount} review{reviewCelebration.reviewCount === 1 ? '' : 's'}.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {nextReviewTarget ? (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewCelebration(null);
                        openReviewModal(nextReviewTarget.item, nextReviewTarget.insight);
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-orange-300 bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-800 transition hover:border-orange-400 hover:bg-orange-200"
                    >
                      Review next item
                    </button>
                  ) : null}
                  <Link
                    to={getProductPath(reviewCelebration.productId)}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    View item
                  </Link>
                  {reviewCelebration.storeSlug ? (
                    <Link
                      to={`/stores/${reviewCelebration.storeSlug}`}
                      className="inline-flex items-center justify-center rounded-full border border-transparent bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Visit {reviewCelebration.storeName || 'store'}
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setReviewCelebration(null)}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-[#102A43] transition hover:border-slate-300 hover:bg-slate-200"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {reviewHomecoming ? (
            <section className="mb-6 overflow-hidden rounded-[2rem] border border-[#102A43]/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(239,246,255,0.92),_rgba(255,247,237,0.92))] px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                    {reviewHomecoming.eyebrow}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                    {reviewHomecoming.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {reviewHomecoming.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {reviewHomecoming.primaryAction === 'review' && nextReviewTarget ? (
                    <button
                      type="button"
                      onClick={() => openReviewModal(nextReviewTarget.item, nextReviewTarget.insight)}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {reviewHomecoming.primaryLabel}
                    </button>
                  ) : null}

                  {reviewHomecoming.primaryAction === 'rebuy' && reviewReadyToBuyAgain[0] ? (
                    <Link
                      to={getProductPath(reviewReadyToBuyAgain[0].productId)}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {reviewHomecoming.primaryLabel}
                    </Link>
                  ) : null}

                  {reviewHomecoming.primaryAction === 'category' && trustedCategories[0] ? (
                    <Link
                      to={`/shop?search=${encodeURIComponent(trustedCategories[0].name)}`}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {reviewHomecoming.primaryLabel}
                    </Link>
                  ) : null}

                  <Link
                    to="/shop"
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    Continue shopping
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          {bestShoppingLane ? (
            <section
              className={`mb-6 overflow-hidden rounded-[2rem] border px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ${
                bestShoppingLane.tone === 'navy'
                  ? 'border-[#102A43]/10 bg-gradient-to-r from-slate-100 via-white to-orange-50'
                  : 'border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50'
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                    Best shopping lane for you
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                    {bestShoppingLane.title}
                  </h3>
                  {bestShoppingLaneConfidence ? (
                    <div className="mt-3 max-w-md">
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center rounded-full border border-white/90 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm">
                          {bestShoppingLaneConfidence.label}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {bestShoppingLaneConfidence.score}% match
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#102A43] via-[#1C4268] to-orange-400 transition-all duration-500"
                          style={{ width: `${bestShoppingLaneConfidence.score}%` }}
                        />
                      </div>
                      {isUsingCustomLane ? (
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Using your saved lane choice
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {laneFreshnessHint ? (
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {laneFreshnessHint}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-slate-600">
                    {bestShoppingLane.description}
                  </p>
                  <div className="mt-4 space-y-2">
                    {bestShoppingLaneReasons.map((reason) => (
                      <div key={reason} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="mt-1 h-2 w-2 rounded-full bg-slate-900" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full border border-white/90 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
                    {bestShoppingLane.helper}
                  </span>
                  {isUsingCustomLane && recommendedShoppingLane ? (
                    <button
                      type="button"
                      onClick={() => chooseShoppingLane('')}
                      className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      Reset to recommended lane
                    </button>
                  ) : null}

                  {bestShoppingLane.cta === 'rebuy' && reviewReadyToBuyAgain[0] ? (
                    <Link
                      to={getProductPath(reviewReadyToBuyAgain[0].productId)}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {bestShoppingLane.label}
                    </Link>
                  ) : null}

                  {bestShoppingLane.cta === 'store' && reviewLedStores[0] ? (
                    <Link
                      to={`/stores/${reviewLedStores[0].storeSlug}`}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {bestShoppingLane.label}
                    </Link>
                  ) : null}

                  {bestShoppingLane.cta === 'category' && trustedCategories[0] ? (
                    <Link
                      to={`/shop?search=${encodeURIComponent(trustedCategories[0].name)}`}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {bestShoppingLane.label}
                    </Link>
                  ) : null}

                  {bestShoppingLane.cta === 'review' && nextReviewTarget ? (
                    <button
                      type="button"
                      onClick={() => openReviewModal(nextReviewTarget.item, nextReviewTarget.insight)}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {bestShoppingLane.label}
                    </button>
                  ) : null}
                </div>
              </div>

              {recentLaneHistory.length ? (
                <div className="mt-5 rounded-[1.5rem] border border-white/90 bg-white/70 px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Recent lane choices
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {recentLaneHistory.map((lane) => (
                      <button
                        key={lane.key}
                        type="button"
                        onClick={() => chooseShoppingLane(lane.key)}
                        className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          bestShoppingLane?.key === lane.key
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900'
                        }`}
                      >
                        {lane.title.replace('Best shopping lane for you: ', '')}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {alternativeShoppingLanes.length ? (
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {alternativeShoppingLanes.map((lane) => (
                    <div
                      key={lane.key}
                      className="rounded-[1.5rem] border border-white/90 bg-white/70 px-4 py-4 shadow-sm"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Another good path
                      </p>
                      <h4 className="mt-2 text-base font-semibold text-slate-900">{lane.title}</h4>
                      <p className="mt-1 text-sm text-slate-600">{lane.description}</p>
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => chooseShoppingLane(lane.key)}
                          className="mb-3 inline-flex items-center justify-center rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100"
                        >
                          Make this my main lane
                        </button>

                        {lane.key === 'review' && nextReviewTarget ? (
                          <button
                            type="button"
                            onClick={() => openReviewModal(nextReviewTarget.item, nextReviewTarget.insight)}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            {lane.label}
                          </button>
                        ) : null}

                        {lane.key === 'rebuy' && reviewReadyToBuyAgain[0] ? (
                          <Link
                            to={getProductPath(reviewReadyToBuyAgain[0].productId)}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            {lane.label}
                          </Link>
                        ) : null}

                        {lane.key === 'store' && reviewLedStores[0] ? (
                          <Link
                            to={`/stores/${reviewLedStores[0].storeSlug}`}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            {lane.label}
                          </Link>
                        ) : null}

                        {lane.key === 'category' && trustedCategories[0] ? (
                          <Link
                            to={`/shop?search=${encodeURIComponent(trustedCategories[0].name)}`}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            {lane.label}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {accountJumpLinks.length ? (
            <section className="mb-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                    Quick jumps
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    Move around your shopper hub faster
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Jump straight to the sections that matter most right now instead of scrolling through the full page.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {accountJumpLinks.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => {
                      const section = document.getElementById(link.id);
                      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
                  >
                    <span>{link.label}</span>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
                      {link.helper}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {shopperActionBar ? (
            <section
              className={`sticky top-20 z-20 mb-6 overflow-hidden rounded-[2rem] border px-5 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur ${
                shopperActionBar.tone === 'amber'
                  ? 'border-orange-200 bg-orange-50/95'
                  : 'border-[#102A43]/10 bg-slate-100/95'
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Shopper action bar
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {shopperActionBar.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {shopperActionBar.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full border border-white/90 bg-white/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
                    {reviewReminderItems.length} review action{reviewReminderItems.length === 1 ? '' : 's'}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/90 bg-white/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
                    {reviewReadyToBuyAgain.length} reorder pick{reviewReadyToBuyAgain.length === 1 ? '' : 's'}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/90 bg-white/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
                    {trustedCategories.length} trusted categor{trustedCategories.length === 1 ? 'y' : 'ies'}
                  </span>

                  {shopperActionBar.cta === 'review' && nextReviewTarget ? (
                    <button
                      type="button"
                      onClick={() => openReviewModal(nextReviewTarget.item, nextReviewTarget.insight)}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {shopperActionBar.label}
                    </button>
                  ) : null}

                  {shopperActionBar.cta === 'rebuy' && reviewReadyToBuyAgain[0] ? (
                    <Link
                      to={getProductPath(reviewReadyToBuyAgain[0].productId)}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {shopperActionBar.label}
                    </Link>
                  ) : null}

                  {shopperActionBar.cta === 'category' && trustedCategories[0] ? (
                    <Link
                      to={`/shop?search=${encodeURIComponent(trustedCategories[0].name)}`}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {shopperActionBar.label}
                    </Link>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {reviewReminderItems.length ? (
            <section id="review-reminders" className="mb-6 overflow-hidden rounded-[2rem] border border-orange-200 bg-gradient-to-r from-orange-50 via-white to-orange-100 px-5 py-5 shadow-[0_18px_50px_rgba(242,140,40,0.12)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-orange-600">
                    Review reminders
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    {reviewReminderItems.length} delivered item{reviewReminderItems.length === 1 ? '' : 's'} still waiting for your feedback
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    A quick rating helps other shoppers buy with confidence and gives strong stores more trust across the marketplace.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-white bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
                      {reviewCompletedCount} already reviewed
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
                      {reviewReminderItems.length} still open
                    </span>
                  </div>
                  {reviewTotalTracked ? (
                    <div className="mt-4 max-w-md">
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <span>Review progress</span>
                        <span>{reviewCompletionRate}% complete</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-orange-400 via-orange-500 to-[#102A43] transition-all duration-500"
                          style={{ width: `${reviewCompletionRate}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {nextReviewTarget ? (
                    <button
                      type="button"
                      onClick={() => openReviewModal(nextReviewTarget.item, nextReviewTarget.insight)}
                      className="inline-flex items-center justify-center rounded-full border border-orange-300 bg-orange-100 px-4 py-2 text-xs font-semibold text-orange-800 transition hover:border-orange-400 hover:bg-orange-200"
                    >
                      Review next item
                    </button>
                  ) : null}
                  {reviewReminderItems.slice(0, 3).map((entry) => (
                    <span
                      key={`${entry.orderId}-${entry.productId}`}
                      className="inline-flex items-center rounded-full border border-white bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm"
                    >
                      {entry.name || 'Delivered item'}
                    </span>
                  ))}
                  {reviewReminderItems.length > 3 ? (
                    <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-100 px-4 py-2 text-xs font-semibold text-orange-700">
                      +{reviewReminderItems.length - 3} more
                    </span>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {nextBestShoppingMoves.length ? (
            <section className="mb-6 overflow-hidden rounded-[2rem] border border-[#102A43]/10 bg-gradient-to-r from-slate-100 via-white to-orange-50 px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                    Your next best move
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    Keep your trusted shopping journey moving
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    These are the fastest next steps based on your reviews, saved trust, and products already performing well for you.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {nextBestShoppingMoves.map((move) => (
                  <article
                    key={move.key}
                    className="rounded-[1.6rem] border border-white/90 bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
                  >
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {move.key === 'review'
                        ? 'Trust action'
                        : move.key === 'rebuy'
                          ? 'Repeat buy'
                          : move.key === 'category'
                            ? 'Category path'
                            : 'Store path'}
                    </span>
                    <h3 className="mt-4 text-lg font-semibold text-slate-900">{move.title}</h3>
                    <p className="mt-2 text-sm text-slate-500">{move.description}</p>

                    <div className="mt-5">
                      {move.key === 'review' ? (
                        <button
                          type="button"
                          onClick={() => openReviewModal(nextReviewTarget.item, nextReviewTarget.insight)}
                          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          Review now
                        </button>
                      ) : null}

                      {move.key === 'rebuy' ? (
                        <Link
                      to={getProductPath(move.productId)}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                          View item
                        </Link>
                      ) : null}

                      {move.key === 'category' ? (
                        <Link
                          to={`/shop?search=${encodeURIComponent(move.categoryName)}`}
                          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          Explore category
                        </Link>
                      ) : null}

                      {move.key === 'store' ? (
                        <Link
                          to={`/stores/${move.storeSlug}`}
                          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          Visit store
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {!reviewReminderItems.length && reviewCompletedCount > 0 ? (
            <section className="mb-6 overflow-hidden rounded-[2rem] border border-[#102A43]/10 bg-gradient-to-r from-slate-100 via-white to-orange-50 px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#102A43]">
                    You&apos;re caught up
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    Every delivered item you tracked already has shopper feedback
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    You have completed {reviewCompletedCount} review{reviewCompletedCount === 1 ? '' : 's'}, helping future shoppers buy with more confidence.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/shop"
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    Keep browsing
                  </Link>
                  <Link
                    to="/account#saved"
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    View saved picks
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          {reviewerSnapshot.totalReviews > 0 ? (
            <section id="shopper-trust-profile" className="mb-6 overflow-hidden rounded-[2rem] border border-[#102A43]/10 bg-gradient-to-r from-slate-100 via-white to-orange-50 px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#102A43]">
                    Your shopper trust profile
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    Your feedback is helping shape the marketplace
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Every review you leave makes it easier for the next shopper to choose with confidence.
                  </p>
                  <div className="mt-4 rounded-[1.5rem] border border-[#102A43]/10 bg-white/80 px-4 py-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#102A43]">
                      Personal shopper summary
                    </p>
                    <div className="mt-3">
                      <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                        {shopperPersonaTag}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      {personalShopperSummary}
                    </p>
                    <div className="mt-3 space-y-2">
                      {shopperStrengths.map((strength) => (
                        <div key={strength} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="mt-1 h-2 w-2 rounded-full bg-[#102A43]" />
                          <span>{strength}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-[1.25rem] border border-orange-200 bg-orange-50/70 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
                        Next growth areas
                      </p>
                      <div className="mt-3 space-y-2">
                        {shopperGrowthAreas.map((area) => (
                          <div key={area} className="flex items-start gap-2 text-sm text-slate-600">
                            <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" />
                            <span>{area}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {reviewerSnapshot.mostRecentReviewAt ? (
                    <p className="mt-3 text-sm font-medium text-slate-500">
                      Last review shared on {new Date(reviewerSnapshot.mostRecentReviewAt).toLocaleDateString()}.
                    </p>
                  ) : null}
                  <div className="mt-4 rounded-[1.5rem] border border-white/90 bg-white/80 px-4 py-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#102A43]">
                          Current milestone
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{reviewerMilestone.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{reviewerMilestone.progressLabel}</p>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
                        {reviewerMilestoneProgress}% progress
                      </span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#102A43] via-[#1C4268] to-orange-400 transition-all duration-500"
                        style={{ width: `${reviewerMilestoneProgress}%` }}
                      />
                    </div>
                    <div className="mt-4 rounded-[1.25rem] border border-[#102A43]/10 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{reviewerMilestoneNudge.headline}</p>
                      <p className="mt-1 text-sm text-slate-500">{reviewerMilestoneNudge.detail}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[1.5rem] border border-[#102A43]/10 bg-gradient-to-br from-slate-100 via-white to-orange-50 p-4 shadow-sm md:col-span-2 xl:col-span-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#102A43]">Trust score</p>
                  <p className="mt-3 text-4xl font-semibold text-slate-900">{reviewerTrustScore.score}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{reviewerTrustScore.label}</p>
                  <p className="mt-2 text-sm text-slate-500">{reviewerTrustScore.description}</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/90">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#102A43] via-[#1C4268] to-orange-400 transition-all duration-500"
                      style={{ width: `${reviewerTrustScore.progressInTier}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {reviewerTrustScore.nextLabel
                      ? `${reviewerTrustScore.remainingToNext} more points to ${reviewerTrustScore.nextLabel}`
                      : 'Top marketplace trust tier reached'}
                  </p>
                  <div className="mt-4 space-y-3">
                    {reviewerTrustScore.components.map((component) => {
                      const width = component.max ? Math.round((component.score / component.max) * 100) : 0;
                      return (
                        <div key={component.key}>
                          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            <span>{component.label}</span>
                            <span>{component.score}/{component.max}</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/90">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#102A43] via-[#1C4268] to-orange-400 transition-all duration-500"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {trustScoreHint ? (
                    <div className="mt-4 rounded-[1.25rem] border border-orange-200 bg-white/80 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
                        Fastest way to grow
                      </p>
                      <p className="mt-2 text-sm text-slate-600">{trustScoreHint}</p>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-[1.5rem] border border-white/90 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Reviews shared</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{reviewerSnapshot.totalReviews}</p>
                  <p className="mt-2 text-sm text-slate-500">Helpful product experiences you have already contributed.</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/90 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Stores strengthened</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{reviewerSnapshot.reviewedStores}</p>
                  <p className="mt-2 text-sm text-slate-500">Storefronts that now carry your shopper voice.</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/90 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Average rating given</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{reviewerSnapshot.averageRatingGiven.toFixed(1)}</p>
                  <p className="mt-2 text-sm text-slate-500">Your typical review score across reviewed purchases.</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/90 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Five-star moments</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{reviewerSnapshot.fiveStarCount}</p>
                  <p className="mt-2 text-sm text-slate-500">Orders that impressed you enough to earn top marks.</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="rounded-[1.5rem] border border-white/90 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Your rating mix</p>
                  <div className="mt-4 space-y-3">
                    {reviewerSignals.ratingCounts.map((entry) => {
                      const width = reviewerSnapshot.totalReviews
                        ? Math.round((entry.count / reviewerSnapshot.totalReviews) * 100)
                        : 0;
                      return (
                        <div key={entry.rating}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-slate-700">
                              {entry.rating} star{entry.rating === 1 ? '' : 's'}
                            </span>
                            <span className="text-slate-500">
                              {entry.count} review{entry.count === 1 ? '' : 's'}
                            </span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#102A43] via-[#1C4268] to-orange-400 transition-all duration-500"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/90 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Most reviewed store</p>
                  {reviewerSignals.mostReviewedStore ? (
                    <>
                      <p className="mt-3 text-2xl font-semibold text-slate-900">
                        {reviewerSignals.mostReviewedStore.name}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        You have already reviewed {reviewerSignals.mostReviewedStore.count} item
                        {reviewerSignals.mostReviewedStore.count === 1 ? '' : 's'} from this storefront.
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      Review a few more delivered orders to reveal your strongest store connection.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.5rem] border border-white/90 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">This month</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{reviewMomentum.thisMonth}</p>
                  <p className="mt-2 text-sm text-slate-500">Reviews shared since the month began.</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/90 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Last 30 days</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{reviewMomentum.last30Days}</p>
                  <p className="mt-2 text-sm text-slate-500">Recent feedback helping the marketplace right now.</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/90 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Stores reached recently</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{reviewMomentum.recentStores}</p>
                  <p className="mt-2 text-sm text-slate-500">Different storefronts strengthened by your latest reviews.</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/90 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Current streak</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{reviewStreak.currentMonthStreak}</p>
                  <p className="mt-2 text-sm text-slate-500">Consecutive month{reviewStreak.currentMonthStreak === 1 ? '' : 's'} with shopper feedback.</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/90 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Active months</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{reviewStreak.activeMonths}</p>
                  <p className="mt-2 text-sm text-slate-500">Months where your review voice showed up in the marketplace.</p>
                </div>
              </div>

              {reviewerAchievements.length ? (
                <div className="mt-4 rounded-[1.5rem] border border-white/90 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Review achievements</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {reviewerAchievements.map((achievement) => (
                      <div
                        key={achievement.key}
                        className="rounded-[1.25rem] border border-[#102A43]/10 bg-gradient-to-r from-slate-100 via-white to-orange-50 px-4 py-4"
                      >
                        <p className="text-sm font-semibold text-slate-900">{achievement.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{achievement.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {shopperHabits.length ? (
                <div className="mt-4 rounded-[1.5rem] border border-white/90 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Top shopper habits</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {shopperHabits.map((habit) => (
                      <div
                        key={habit.key}
                        className="rounded-[1.25rem] border border-orange-200 bg-gradient-to-r from-orange-50 via-white to-slate-100 px-4 py-4"
                      >
                        <p className="text-sm font-semibold text-slate-900">{habit.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{habit.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {reviewComebackNudge ? (
                <div className="mt-4 rounded-[1.5rem] border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">Comeback moment</p>
                  <h4 className="mt-2 text-lg font-semibold text-slate-900">{reviewComebackNudge.title}</h4>
                  <p className="mt-2 text-sm text-slate-600">{reviewComebackNudge.description}</p>
                  <div className="mt-4">
                    {reviewComebackNudge.action === 'review' && nextReviewTarget ? (
                      <button
                        type="button"
                        onClick={() => openReviewModal(nextReviewTarget.item, nextReviewTarget.insight)}
                        className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        {reviewComebackNudge.label}
                      </button>
                    ) : null}
                    {reviewComebackNudge.action === 'category' && trustedCategories[0] ? (
                      <Link
                        to={`/shop?search=${encodeURIComponent(trustedCategories[0].name)}`}
                        className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        {reviewComebackNudge.label}
                      </Link>
                    ) : null}
                    {reviewComebackNudge.action === 'shop' ? (
                      <Link
                        to="/shop"
                        className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        {reviewComebackNudge.label}
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {reviewImpactItems.length ? (
            <section id="review-impact" className="mb-6 overflow-hidden rounded-[2rem] border border-orange-200 bg-gradient-to-r from-orange-50 via-white to-slate-100 px-5 py-5 shadow-[0_18px_50px_rgba(242,140,40,0.1)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-orange-700">
                    Your review impact
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    Feedback you&apos;ve already shared is strengthening shopper trust
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    These are some of the items where your voice is already part of the marketplace buying signal.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {reviewImpactItems.map((item) => (
                  <article
                    key={`${item.orderId}-${item.productId}`}
                    className="overflow-hidden rounded-[1.6rem] border border-white/90 bg-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
                  >
                    <Link to={getProductPath(item.productId)} className="block">
                      <div className="h-44 overflow-hidden bg-slate-100">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]" />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-orange-50 text-sm font-medium text-slate-500">
                            Reviewed item
                          </div>
                        )}
                      </div>
                    </Link>

                    <div className="space-y-3 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                          Your review is live
                        </span>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {item.storeName}
                        </span>
                      </div>

                      <div>
                        <Link to={getProductPath(item.productId)} className="text-base font-semibold text-slate-900 transition hover:text-[#102A43]">
                          {item.name}
                        </Link>
                        <p className="mt-1 text-sm text-slate-500">
                          You rated this {item.userReview?.rating || 0} star{Number(item.userReview?.rating || 0) === 1 ? '' : 's'}.
                        </p>
                        {item.reviewedAt ? (
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Reviewed {new Date(item.reviewedAt).toLocaleDateString()}
                          </p>
                        ) : null}
                      </div>

                      <MarketplaceRating summary={item.summary} size="md" />

                      {item.userReview?.title || item.userReview?.comment ? (
                        <div className="rounded-[1.25rem] border border-orange-200 bg-orange-50/70 px-4 py-3">
                          {item.userReview?.title ? (
                            <p className="text-sm font-semibold text-slate-900">
                              {item.userReview.title}
                            </p>
                          ) : null}
                          {item.userReview?.comment ? (
                            <p className="mt-1 text-sm text-slate-600">
                              &quot;{item.userReview.comment.slice(0, 140)}
                              {item.userReview.comment.length > 140 ? '...' : ''}&quot;
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-3">
                        <Link
                          to={getProductPath(item.productId)}
                          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          View item
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            openReviewModal(
                              {
                                product: item.productId,
                                name: item.name,
                                image: item.image,
                              },
                              {
                                summary: item.summary,
                                userReview: item.userReview,
                                reviewEligibility: { canReview: true },
                              }
                            )
                          }
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          Edit review
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {reviewReadyToBuyAgain.length ? (
            <section id="ready-to-order-again" className="mb-6 overflow-hidden rounded-[2rem] border border-[#102A43]/10 bg-gradient-to-r from-slate-100 via-white to-orange-50 px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#102A43]">
                    Ready to order again
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    Products you trusted before and can buy again right now
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    These reviewed items are still available, making it easy to return to products that already worked well for you.
                  </p>
                </div>
                <Link
                  to="/shop"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                  Explore more in shop
                </Link>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {reviewReadyToBuyAgain.map((item) => (
                  <article
                    key={`rebuy-${item.orderId}-${item.productId}`}
                    className="overflow-hidden rounded-[1.6rem] border border-white/90 bg-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
                  >
                    <Link to={getProductPath(item.productId)} className="block">
                      <div className="h-44 overflow-hidden bg-slate-100">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]" />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-orange-50 text-sm font-medium text-slate-500">
                            Ready to buy again
                          </div>
                        )}
                      </div>
                    </Link>

                    <div className="space-y-3 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                          Reorder-ready
                        </span>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {item.storeName}
                        </span>
                      </div>

                      <div>
                        <Link to={getProductPath(item.productId)} className="text-base font-semibold text-slate-900 transition hover:text-[#102A43]">
                          {item.name}
                        </Link>
                        <p className="mt-1 text-sm text-slate-500">
                          You already reviewed this item and it remains in stock.
                        </p>
                      </div>

                      <MarketplaceRating summary={item.summary} size="md" />

                      <div className="flex items-center justify-between">
                        <p className="text-lg font-semibold text-slate-900">
                          TZS {Number(item.price || 0).toLocaleString()}
                        </p>
                        <Link
                          to={getProductPath(item.productId)}
                          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          View item
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {trustedCategories.length ? (
            <section id="trusted-categories" className="mb-6 overflow-hidden rounded-[2rem] border border-[#102A43]/10 bg-gradient-to-r from-slate-100 via-white to-orange-50 px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#102A43]">
                    Trusted categories
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    Categories where your buying confidence is already strongest
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    These are the product groups you have already reviewed, making them the easiest place to keep shopping with confidence.
                  </p>
                </div>
                <Link
                  to="/shop"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                  Browse all categories
                </Link>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {trustedCategories.map((category) => (
                  <article
                    key={category.name}
                    className="rounded-[1.6rem] border border-white/90 bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                        Trusted category
                      </span>
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {category.reviewCount} review{category.reviewCount === 1 ? '' : 's'}
                      </span>
                    </div>

                    <h3 className="mt-4 text-lg font-semibold text-slate-900">{category.name}</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Average rating you gave here: {category.averageRatingGiven.toFixed(1)} stars.
                    </p>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#102A43] via-[#1C4268] to-orange-400"
                        style={{ width: `${Math.max(12, Math.min(100, Math.round((category.averageRatingGiven / 5) * 100)))}%` }}
                      />
                    </div>

                    <div className="mt-5">
                      <Link
                        to={`/shop?search=${encodeURIComponent(category.name)}`}
                        className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Explore this category
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {topReviewHighlights.length ? (
            <section className="mb-6 overflow-hidden rounded-[2rem] border border-[#102A43]/10 bg-gradient-to-r from-slate-100 via-white to-orange-50 px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#102A43]">
                    Top review highlights
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    Shoppers are loving these picks right now
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Strong ratings and repeat buyer confidence make these easy products to revisit while you browse your account.
                  </p>
                </div>
                <Link
                  to="/shop"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                  Explore more in shop
                </Link>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {topReviewHighlights.map((product) => (
                  <article
                    key={product._id}
                    className="overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
                  >
                      <Link to={getProductPath(product)} className="block">
                      <div className="h-44 overflow-hidden bg-slate-100">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]" />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-orange-50 text-sm font-medium text-slate-500">
                            Product preview
                          </div>
                        )}
                      </div>
                    </Link>

                    <div className="space-y-3 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                          Shopper favorite
                        </span>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {product.storeName}
                        </span>
                      </div>

                      <div>
                          <Link to={getProductPath(product)} className="text-base font-semibold text-slate-900 transition hover:text-[#102A43]">
                          {product.name}
                        </Link>
                        <p className="mt-1 text-sm text-slate-500">
                          Chosen for strong shopper feedback and dependable value.
                        </p>
                      </div>

                      <MarketplaceRating summary={product.ratingSummary} size="md" />

                      <div className="flex items-center justify-between">
                        <p className="text-lg font-semibold text-slate-900">
                          TZS {Number(product.price || 0).toLocaleString()}
                        </p>
                        <Link
                          to={getProductPath(product)}
                          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          View item
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {reviewLedStores.length ? (
            <section id="trusted-stores" className="mb-6 overflow-hidden rounded-[2rem] border border-[#102A43]/10 bg-gradient-to-r from-slate-100 via-white to-orange-50 px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#102A43]">
                    Trusted stores
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    Strong shopper feedback is lifting these storefronts
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Browse stores with reliable ratings and multiple reviewed products when you want your next order to feel easier.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {reviewLedStores.map((store) => (
                  <article
                    key={store.storeSlug}
                    className="rounded-[1.6rem] border border-white/90 bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                        Trusted by shoppers
                      </span>
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {store.productCount} rated item{store.productCount === 1 ? '' : 's'}
                      </span>
                    </div>

                    <h3 className="mt-4 text-lg font-semibold text-slate-900">{store.storeName}</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Built on {store.reviewCount} shopper review{store.reviewCount === 1 ? '' : 's'} across highly rated products.
                    </p>

                    <div className="mt-4">
                      <MarketplaceRating
                        summary={{
                          averageRating: store.averageRating,
                          reviewCount: store.reviewCount,
                        }}
                        size="md"
                      />
                    </div>

                    {store.bestProduct ? (
                      <div className="mt-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Standout pick
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {store.bestProduct.name}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          One of the strongest-rated products from this storefront right now.
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        to={`/stores/${store.storeSlug}`}
                        className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Visit store
                      </Link>
                      {store.bestProduct ? (
                        <Link
                          to={getProductPath(store.bestProduct)}
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          View top item
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {reviewedStoreFinds.length ? (
            <section className="mb-6 overflow-hidden rounded-[2rem] border border-[#102A43]/10 bg-gradient-to-r from-slate-100 via-white to-orange-50 px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#102A43]">
                    More from stores you reviewed
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    Keep shopping from storefronts you already know
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    These highly rated picks come from stores where you have already shared shopper feedback, making your next order feel faster and more familiar.
                  </p>
                </div>
                <Link
                  to="/shop"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                  Continue shopping
                </Link>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {reviewedStoreFinds.map((product) => {
                  const storeName =
                    product?.vendor?.storeName ||
                    product?.store?.name ||
                    product?.storeName ||
                    'Trusted store';

                  return (
                    <article
                      key={product._id}
                      className="overflow-hidden rounded-[1.6rem] border border-white/90 bg-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
                    >
                      <Link to={getProductPath(product)} className="block">
                        <div className="h-44 overflow-hidden bg-slate-100">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]" />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-orange-50 text-sm font-medium text-slate-500">
                              Product preview
                            </div>
                          )}
                        </div>
                      </Link>

                      <div className="space-y-3 px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                            Reviewed store pick
                          </span>
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {storeName}
                          </span>
                        </div>

                        <div>
                          <Link to={getProductPath(product)} className="text-base font-semibold text-slate-900 transition hover:text-[#102A43]">
                            {product.name}
                          </Link>
                          <p className="mt-1 text-sm text-slate-500">
                            A strong-rated option from a storefront you have already experienced.
                          </p>
                        </div>

                        <MarketplaceRating summary={product.ratingSummary || {
                          averageRating: Number(product?.averageRating || 0),
                          reviewCount: Number(product?.reviewCount || 0),
                        }} size="md" />

                        <div className="flex items-center justify-between">
                          <p className="text-lg font-semibold text-slate-900">
                            TZS {Number(product.price || 0).toLocaleString()}
                          </p>
                          <Link
                            to={getProductPath(product)}
                            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                          >
                            View item
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {orders.length === 0 ? (
                <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
                  <FiClock className="mx-auto mb-3 text-3xl" />
                  You have not placed an order yet.
                </div>
              ) : (
                orders.map((order) => (
                  <OrderCard
                    key={order._id}
                    order={order}
                    busy={busyId === order._id}
                    onRefreshPaymentStatus={refreshPaymentStatus}
                    onRetryPaymentPush={retryPaymentPush}
                    onReorder={handleReorder}
                    onReportDeliveryIssue={reportDeliveryIssue}
                    getReviewInsight={getReviewInsight}
                    onOpenReview={openReviewModal}
                  />
                ))
              )}
            </motion.section>
          </div>
        </div>
      </div>
      {activeReview ? (
        <QuickReviewModal
          activeReview={activeReview}
          setActiveReview={setActiveReview}
          submitting={reviewSubmitting}
          onClose={closeReviewModal}
          onSubmit={submitQuickReview}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{Number(value || 0).toLocaleString()}</p>
    </div>
  );
}
function QuickReviewModal({ activeReview, setActiveReview, submitting, onClose, onSubmit }) {
  const productName = activeReview?.product?.name || activeReview?.orderItem?.name || 'This item';
  const productImage = activeReview?.product?.image || activeReview?.orderItem?.image || '';
  const reviewSummary = activeReview?.insight?.summary || activeReview?.product?.ratingSummary || null;
  const storeSlug =
    activeReview?.product?.vendor?.storeSlug ||
    activeReview?.product?.store?.slug ||
    activeReview?.product?.storeSlug ||
    '';
  const storeName =
    activeReview?.product?.vendor?.storeName ||
    activeReview?.product?.store?.name ||
    activeReview?.product?.storeName ||
    'this store';
  const actionLabel = activeReview?.justSubmitted
    ? 'Saved'
    : activeReview?.hasExistingReview
      ? 'Update review'
      : 'Share review';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/15 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.3)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102A43]">
              Shopper review
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">{productName}</h3>
            <p className="mt-2 text-sm text-slate-500">
              Share what stood out so other shoppers can buy with confidence.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close review form"
          >
            X
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[1.5rem] bg-slate-100">
              {productImage ? (
                <img src={productImage} alt={productName} className="h-52 w-full object-cover" />
              ) : (
                <div className="flex h-52 items-center justify-center bg-gradient-to-br from-slate-200 via-white to-orange-50 text-sm font-medium text-slate-500">
                  Product preview
                </div>
              )}
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                Current shopper signal
              </p>
              <div className="mt-3">
                <MarketplaceRating summary={reviewSummary} size="md" />
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Honest feedback helps shoppers understand quality, value, and delivery expectations.
              </p>
            </div>
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            {activeReview?.justSubmitted ? (
              <div className="space-y-3">
                <div className="rounded-[1.5rem] border border-[#102A43]/10 bg-slate-100 px-4 py-4 text-sm text-[#102A43]">
                  <p className="font-semibold">Your review is now live for shoppers.</p>
                  <p className="mt-1 text-[#102A43]">
                    Thank you for sharing helpful buying feedback for {productName}.
                  </p>
                </div>

                {storeSlug ? (
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Keep this seller close
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      Explore more from {storeName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      If this order impressed you, you can keep shopping from the same storefront and discover similar finds faster.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        to={`/stores/${storeSlug}`}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        Visit store
                      </Link>
                      <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center justify-center rounded-full border border-transparent bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Keep shopping
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div>
              <label className="text-sm font-semibold text-slate-900">Your rating</label>
              <div className="mt-3 flex flex-wrap gap-2">
                {[5, 4, 3, 2, 1].map((value) => {
                  const selected = Number(activeReview?.rating || 0) === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setActiveReview((current) =>
                          current
                            ? {
                                ...current,
                                rating: value,
                              }
                            : current
                        )
                      }
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        selected
                          ? 'border-orange-300 bg-orange-50 text-orange-700 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      }`}
                    >
                      <span className="text-base leading-none">{selected ? '★' : '☆'}</span>
                      {value} star{value === 1 ? '' : 's'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="quick-review-title" className="text-sm font-semibold text-slate-900">
                Review title
              </label>
              <input
                id="quick-review-title"
                type="text"
                maxLength={120}
                value={activeReview?.title || ''}
                onChange={(event) =>
                  setActiveReview((current) =>
                    current
                      ? {
                          ...current,
                          title: event.target.value,
                        }
                      : current
                  )
                }
                placeholder="What should shoppers notice first?"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#102A43]/35 focus:ring-4 focus:ring-orange-100"
              />
            </div>

            <div>
              <label htmlFor="quick-review-comment" className="text-sm font-semibold text-slate-900">
                Review details
              </label>
              <textarea
                id="quick-review-comment"
                rows="6"
                maxLength={900}
                value={activeReview?.comment || ''}
                onChange={(event) =>
                  setActiveReview((current) =>
                    current
                      ? {
                          ...current,
                          comment: event.target.value,
                        }
                      : current
                  )
                }
                placeholder="Tell shoppers about quality, fit, delivery, or anything that helped you decide."
                className="mt-2 w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#102A43]/35 focus:ring-4 focus:ring-orange-100"
              />
              <p className="mt-2 text-xs text-slate-400">
                Keep it clear and helpful. Your review can still be updated later.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Not now
              </button>
              <button
                type={activeReview?.justSubmitted ? 'button' : 'submit'}
                onClick={activeReview?.justSubmitted ? onClose : undefined}
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Saving review...' : actionLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
