import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Order = sequelize.define(
  "Order",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: "total",
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "paid",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "refunded"
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    deliveryType: {
      type: DataTypes.ENUM("home", "pickup"),
      allowNull: false,
      defaultValue: "home",
      field: "delivery_type",
    },
    deliveryAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      field: "delivery_address",
    },
    deliveryContactPhone: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      field: "delivery_contact_phone",
    },
    riderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: "rider_id",
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "assigned_at",
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "accepted_at",
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "completed_at",
    },
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "cash_on_delivery",
      field: "payment_method",
    },
    isPaid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_paid",
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "paid_at",
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "delivered_at",
    },
  },
  {
    tableName: "orders",
    createdAt: "created_at",
    updatedAt: false,
  }
);

export default Order;
