import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const NotificationEvent = sequelize.define(
  "NotificationEvent",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    audience: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: "user_id",
    },
    notificationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: "notification_id",
    },
    sourceInstance: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "source_instance",
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: "notification_events",
    createdAt: "created_at",
    updatedAt: false,
  }
);

export default NotificationEvent;
