import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const VendorPayout = sequelize.define(
  "VendorPayout",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    vendorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "vendor_id",
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "order_id",
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM("pending", "paid", "on_hold"),
      allowNull: false,
      defaultValue: "pending",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: "created_by",
    },
    processedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: "processed_by",
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "paid_at",
    },
  },
  {
    tableName: "vendor_payouts",
    createdAt: "created_at",
    updatedAt: false,
  }
);

export default VendorPayout;
