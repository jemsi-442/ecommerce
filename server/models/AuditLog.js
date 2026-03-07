import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const AuditLog = sequelize.define(
  "AuditLog",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: "order_id",
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: "user_id",
    },
    riderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: "rider_id",
    },
    userName: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      field: "user_name",
    },
    riderName: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      field: "rider_name",
    },
    type: {
      type: DataTypes.ENUM("status", "delivery", "notification", "refund", "user"),
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    meta: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: "audit_logs",
    createdAt: "created_at",
    updatedAt: false,
  }
);

export default AuditLog;
