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
      defaultValue: "mobile_money",
      field: "payment_method",
    },
    paymentProvider: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      field: "payment_provider",
    },
    paymentReference: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      field: "payment_reference",
    },
    paymentStatus: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      field: "payment_status",
    },
    paymentExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "payment_expires_at",
    },
    paymentFailedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "payment_failed_at",
    },
    paymentFailureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
      field: "payment_failure_reason",
    },
    inventoryReserved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "inventory_reserved",
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
