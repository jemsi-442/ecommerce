import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Rider = sequelize.define(
  "Rider",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "user_id",
    },
    vendorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: "vendor_id",
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    available: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
    currentOrders: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "current_orders",
    },
    lastAssignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "last_assigned_at",
    },
  },
  {
    tableName: "riders",
    createdAt: "created_at",
    updatedAt: false,
  }
);

export default Rider;
