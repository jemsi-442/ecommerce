import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Product = sequelize.define(
  "Product",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "",
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    image: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    sku: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
      set(value) {
        if (value == null || value === "") {
          this.setDataValue("sku", null);
          return;
        }
        this.setDataValue("sku", String(value).trim().toUpperCase());
      },
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "approved_at",
    },
    approvedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: "approved_by",
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "reviewed_at",
    },
    reviewedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: "reviewed_by",
    },
    reviewNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
      field: "review_notes",
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: "created_by",
    },
  },
  {
    tableName: "products",
    createdAt: "created_at",
    updatedAt: false,
  }
);

export default Product;
