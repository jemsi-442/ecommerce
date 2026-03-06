import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Order = sequelize.define(
  "Order",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    items: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    totalAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
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
    },
    deliveryAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    deliveryContactPhone: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "",
    },
    riderId: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "cash_on_delivery",
    },
    isPaid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: "orders",
    timestamps: true,
  }
);

export default Order;
