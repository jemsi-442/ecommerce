import bcrypt from "bcryptjs";
import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const normalizeNullableText = (value) => {
  if (value == null) return null;
  const normalized = String(value).trim().replace(/\s+/g, " ");
  return normalized || null;
};

const normalizeStoreSlug = (value) => {
  if (value == null) return null;

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized || null;
};

const normalizeSavedProductIds = (value) => {
  let entries = value;

  if (typeof entries === "string") {
    try {
      entries = JSON.parse(entries);
    } catch {
      entries = [];
    }
  }

  if (!Array.isArray(entries)) {
    return [];
  }

  const uniqueIds = [];
  const seen = new Set();

  for (const entry of entries) {
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
  let entries = value;

  if (typeof entries === "string") {
    try {
      entries = JSON.parse(entries);
    } catch {
      entries = [];
    }
  }

  if (!Array.isArray(entries)) {
    return [];
  }

  const uniqueSlugs = [];
  const seen = new Set();

  for (const entry of entries) {
    const slug = normalizeStoreSlug(entry);
    if (!slug || seen.has(slug)) {
      continue;
    }

    seen.add(slug);
    uniqueSlugs.push(slug);
  }

  return uniqueSlugs;
};

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
      set(value) {
        this.setDataValue("email", String(value).trim().toLowerCase());
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("customer", "vendor", "admin", "rider"),
      allowNull: false,
      defaultValue: "customer",
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    phone: {
      type: DataTypes.STRING(40),
      allowNull: true,
      defaultValue: null,
      set(value) {
        this.setDataValue("phone", normalizeNullableText(value));
      },
    },
    storeName: {
      type: DataTypes.STRING(120),
      allowNull: true,
      defaultValue: null,
      field: "store_name",
      set(value) {
        this.setDataValue("storeName", normalizeNullableText(value));
      },
    },
    storeSlug: {
      type: DataTypes.STRING(80),
      allowNull: true,
      unique: true,
      defaultValue: null,
      field: "store_slug",
      set(value) {
        this.setDataValue("storeSlug", normalizeStoreSlug(value));
      },
    },
    businessPhone: {
      type: DataTypes.STRING(40),
      allowNull: true,
      defaultValue: null,
      field: "business_phone",
      set(value) {
        this.setDataValue("businessPhone", normalizeNullableText(value));
      },
    },
    businessDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
      field: "business_description",
      set(value) {
        this.setDataValue("businessDescription", normalizeNullableText(value));
      },
    },
    savedProductIds: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      defaultValue: "[]",
      field: "saved_product_ids",
      get() {
        return normalizeSavedProductIds(this.getDataValue("savedProductIds"));
      },
      set(value) {
        this.setDataValue("savedProductIds", JSON.stringify(normalizeSavedProductIds(value)));
      },
    },
    favoriteStoreSlugs: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      defaultValue: "[]",
      field: "favorite_store_slugs",
      get() {
        return normalizeFavoriteStoreSlugs(this.getDataValue("favoriteStoreSlugs"));
      },
      set(value) {
        this.setDataValue("favoriteStoreSlugs", JSON.stringify(normalizeFavoriteStoreSlugs(value)));
      },
    },
  },
  {
    tableName: "users",
    createdAt: "created_at",
    updatedAt: false,
    hooks: {
      async beforeCreate(user) {
        user.password = await bcrypt.hash(user.password, 10);
      },
      async beforeUpdate(user) {
        if (user.changed("password")) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
    },
  }
);

User.prototype.matchPassword = async function matchPassword(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export default User;
