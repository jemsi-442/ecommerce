import express from "express";
import { Op } from "sequelize";
import { Product, Rider, User } from "../models/index.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { adminMiddleware } from "../middleware/roleMiddleware.js";
import { serializeProduct, serializeUser } from "../utils/serializers.js";

const router = express.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_MANAGED_ROLES = ["customer", "vendor", "admin"];

const normalizeEmail = (value = "") => String(value).trim().toLowerCase();
const normalizeName = (value = "") => String(value).trim().replace(/\s+/g, " ");
const normalizePhone = (value = "") => String(value).trim();
const normalizeSavedProductIds = (value) => {
  const input = Array.isArray(value) ? value : [];
  const uniqueIds = [];
  const seen = new Set();

  for (const entry of input) {
    const productId = Number.parseInt(entry, 10);
    if (!Number.isInteger(productId) || productId <= 0 || seen.has(productId)) {
      continue;
    }

    seen.add(productId);
    uniqueIds.push(productId);
  }

  return uniqueIds;
};

const normalizeFavoriteStoreSlugs = (value) => {
  const input = Array.isArray(value) ? value : [];
  const uniqueSlugs = [];
  const seen = new Set();

  for (const entry of input) {
    const storeSlug = String(entry || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

    if (!storeSlug || seen.has(storeSlug)) {
      continue;
    }

    seen.add(storeSlug);
    uniqueSlugs.push(storeSlug);
  }

  return uniqueSlugs;
};

const getSavedProductsForIds = async (productIds) => {
  if (!productIds.length) {
    return [];
  }

  const products = await Product.findAll({
    where: {
      id: productIds,
      status: "approved",
    },
    include: [
      {
        model: User,
        as: "creator",
        attributes: ["id", "name", "role", "storeName", "storeSlug"],
        required: false,
      },
    ],
  });

  const byId = new Map(products.map((product) => [Number(product.id), product]));
  return productIds
    .map((productId) => byId.get(Number(productId)))
    .filter(Boolean)
    .map((product) => serializeProduct(product));
};


const getFavoriteStoresForSlugs = async (storeSlugs) => {
  if (!storeSlugs.length) {
    return [];
  }

  const stores = await User.findAll({
    where: {
      role: "vendor",
      active: true,
      storeSlug: {
        [Op.in]: storeSlugs,
      },
    },
  });

  if (!stores.length) {
    return [];
  }

  const storesBySlug = new Map();
  const storesById = new Map();

  stores.forEach((store) => {
    const serialized = serializeUser(store);
    const snapshot = {
      ...serialized,
      name: serialized.storeName || serialized.name || serialized.storeSlug,
      sampleImage: null,
      itemCount: 0,
      inStockCount: 0,
      startingPrice: 0,
    };

    storesBySlug.set(serialized.storeSlug, snapshot);
    storesById.set(Number(serialized.id), snapshot);
  });

  const products = await Product.findAll({
    where: {
      createdBy: {
        [Op.in]: Array.from(storesById.keys()),
      },
      status: "approved",
    },
    attributes: ["id", "createdBy", "price", "stock", "image"],
  });

  products.forEach((product) => {
    const snapshot = storesById.get(Number(product.createdBy));
    if (!snapshot) {
      return;
    }

    snapshot.itemCount += 1;

    if (Number(product.stock || 0) > 0) {
      snapshot.inStockCount += 1;
    }

    if (!snapshot.sampleImage && product.image) {
      snapshot.sampleImage = product.image;
    }

    if (Number(product.price || 0) > 0) {
      snapshot.startingPrice = snapshot.startingPrice > 0
        ? Math.min(snapshot.startingPrice, Number(product.price || 0))
        : Number(product.price || 0);
    }
  });

  return storeSlugs
    .map((storeSlug) => storesBySlug.get(storeSlug))
    .filter(Boolean);
};

const sendSavedProductsResponse = async (res, user, message = null) => {
  const productIds = normalizeSavedProductIds(user.savedProductIds || []);
  const items = await getSavedProductsForIds(productIds);
  const nextProductIds = items.map((item) => Number(item._id));

  if (JSON.stringify(nextProductIds) !== JSON.stringify(productIds)) {
    user.savedProductIds = nextProductIds;
    await user.save();
  }

  return res.json({
    ...(message ? { message } : {}),
    data: {
      productIds: nextProductIds,
      items,
      count: items.length,
    },
  });
};


const sendFavoriteStoresResponse = async (res, user, message = null) => {
  const storeSlugs = normalizeFavoriteStoreSlugs(user.favoriteStoreSlugs || []);
  const items = await getFavoriteStoresForSlugs(storeSlugs);
  const nextStoreSlugs = items.map((item) => item.storeSlug).filter(Boolean);

  if (JSON.stringify(nextStoreSlugs) !== JSON.stringify(storeSlugs)) {
    user.favoriteStoreSlugs = nextStoreSlugs;
    await user.save();
  }

  return res.json({
    ...(message ? { message } : {}),
    data: {
      storeSlugs: nextStoreSlugs,
      items,
      count: items.length,
    },
  });
};

router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user._id, {
      include: [{ model: Rider, as: "riderProfile", required: false }],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ data: serializeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/me/saved-products", verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return await sendSavedProductsResponse(res, user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/me/saved-products", verifyToken, async (req, res) => {
  if (!Array.isArray(req.body?.productIds)) {
    return res.status(400).json({ message: "productIds must be an array" });
  }

  try {
    const user = await User.findByPk(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const requestedProductIds = normalizeSavedProductIds(req.body.productIds);
    const approvedProducts = await getSavedProductsForIds(requestedProductIds);
    user.savedProductIds = approvedProducts.map((item) => Number(item._id));
    await user.save();

    return res.json({
      message: "Saved products updated",
      data: {
        productIds: user.savedProductIds,
        items: approvedProducts,
        count: approvedProducts.length,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/me/favorite-stores", verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return await sendFavoriteStoresResponse(res, user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/me/favorite-stores", verifyToken, async (req, res) => {
  if (!Array.isArray(req.body?.storeSlugs)) {
    return res.status(400).json({ message: "storeSlugs must be an array" });
  }

  try {
    const user = await User.findByPk(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const requestedStoreSlugs = normalizeFavoriteStoreSlugs(req.body.storeSlugs);
    const approvedStores = await getFavoriteStoresForSlugs(requestedStoreSlugs);
    user.favoriteStoreSlugs = approvedStores.map((item) => item.storeSlug).filter(Boolean);
    await user.save();

    return res.json({
      message: "Favorite stores updated",
      data: {
        storeSlugs: user.favoriteStoreSlugs,
        items: approvedStores,
        count: approvedStores.length,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.patch("/me", verifyToken, async (req, res) => {
  const name = normalizeName(req.body?.name || "");
  const email = normalizeEmail(req.body?.email || "");
  const businessPhone = normalizePhone(req.body?.businessPhone || req.body?.phone || "");

  if (name.length < 2) {
    return res.status(400).json({ message: "Name must be at least 2 characters" });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: "Valid email is required" });
  }

  try {
    const user = await User.findByPk(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser && String(existingUser.id) !== String(user.id)) {
      return res.status(400).json({ message: "Email already in use" });
    }

    user.name = name;
    user.email = email;
    user.businessPhone = businessPhone || null;
    await user.save();

    return res.json({
      message: "Profile updated successfully",
      data: serializeUser(user),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/", verifyToken, adminMiddleware, async (req, res) => {
  try {
    const users = await User.findAll({
      include: [{ model: Rider, as: "riderProfile", required: false }],
      order: [["created_at", "DESC"]],
    });
    res.json(users.map((user) => serializeUser(user)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/password", verifyToken, adminMiddleware, async (req, res) => {
  const password = String(req.body?.password || "");

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = password;
    await user.save();

    res.json({
      message: "Password reset successfully",
      data: serializeUser(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/riders", verifyToken, adminMiddleware, async (req, res) => {
  const name = normalizeName(req.body?.name || "");
  const email = normalizeEmail(req.body?.email || "");
  const phone = normalizePhone(req.body?.phone || "");
  const password = String(req.body?.password || "");

  if (name.length < 2) {
    return res.status(400).json({ message: "Name must be at least 2 characters" });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: "Valid email is required" });
  }

  if (phone.length < 6) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  try {
    const result = await User.sequelize.transaction(async (transaction) => {
      let user = await User.findOne({ where: { email }, transaction });

      if (user?.role === "admin") {
        throw new Error("Admin account cannot be converted to rider");
      }

      if (user) {
        user.name = name;
        user.password = password;
        user.role = "rider";
        user.active = true;
        await user.save({ transaction });
      } else {
        user = await User.create(
          {
            name,
            email,
            password,
            role: "rider",
            active: true,
          },
          { transaction }
        );
      }

      let riderProfile = await Rider.findOne({ where: { userId: user.id }, transaction });

      if (riderProfile) {
        riderProfile.name = name;
        riderProfile.phone = phone;
        riderProfile.available = true;
        riderProfile.isActive = true;
        await riderProfile.save({ transaction });
      } else {
        riderProfile = await Rider.create(
          {
            userId: user.id,
            name,
            phone,
            available: true,
            isActive: true,
          },
          { transaction }
        );
      }

      return { user, riderProfile };
    });

    return res.status(201).json({
      message: "Rider account saved successfully",
      data: {
        user: serializeUser(result.user),
        rider: result.riderProfile.toJSON(),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: err.message || "Failed to create rider" });
  }
});

router.patch("/:id/role", verifyToken, adminMiddleware, async (req, res) => {
  const requestedRole = String(req.body?.role || "").trim();
  const role = requestedRole === "user" ? "customer" : requestedRole;

  if (!ALLOWED_MANAGED_ROLES.includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "rider") {
      return res.status(400).json({ message: "Use the rider management flow for rider accounts" });
    }

    user.role = role;
    await user.save();
    res.json(serializeUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/status", verifyToken, adminMiddleware, async (req, res) => {
  const { active } = req.body;
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.active = Boolean(active);
    await user.save();
    res.json(serializeUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/rider-status", verifyToken, adminMiddleware, async (req, res) => {
  try {
    const rider = await Rider.findOne({ where: { userId: req.params.id } });
    if (!rider) return res.status(404).json({ message: "Rider profile not found" });

    if (typeof req.body?.isActive === "boolean") {
      rider.isActive = req.body.isActive;
    }

    if (typeof req.body?.available === "boolean") {
      rider.available = req.body.available;
    }

    await rider.save();

    res.json({
      message: "Rider status updated successfully",
      data: rider.toJSON(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
