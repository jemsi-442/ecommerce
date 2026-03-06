import User from "./User.js";
import Rider from "./Rider.js";
import Product from "./Product.js";
import Order from "./Order.js";
import Notification from "./Notification.js";
import AuditLog from "./AuditLog.js";

User.hasOne(Rider, { foreignKey: "userId", as: "riderProfile" });
Rider.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(Order, { foreignKey: "userId", as: "orders" });
Order.belongsTo(User, { foreignKey: "userId", as: "user" });

Rider.hasMany(Order, { foreignKey: "riderId", as: "assignedOrders" });
Order.belongsTo(Rider, { foreignKey: "riderId", as: "rider" });

User.hasMany(Product, { foreignKey: "createdBy", as: "createdProducts" });
Product.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
Product.belongsTo(User, { foreignKey: "approvedBy", as: "approver" });

Order.hasMany(Notification, { foreignKey: "orderId", as: "notifications" });
Notification.belongsTo(Order, { foreignKey: "orderId", as: "order" });

export { User, Rider, Product, Order, Notification, AuditLog };
