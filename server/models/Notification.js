import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Notification = sequelize.define(
  "Notification",
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
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    audience: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "customer",
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    customerName: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      field: "customer_name",
    },
    riderName: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      field: "rider_name",
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: "notifications",
    createdAt: "created_at",
    updatedAt: false,
  }
);

export default Notification;
