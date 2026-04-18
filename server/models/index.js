import User from "./User.js";
import Rider from "./Rider.js";
import Product from "./Product.js";
import Order from "./Order.js";
import OrderItem from "./OrderItem.js";
import Notification from "./Notification.js";
import NotificationEvent from "./NotificationEvent.js";
import AuditLog from "./AuditLog.js";
import VendorPayout from "./VendorPayout.js";
import ProductReview from "./ProductReview.js";

User.hasOne(Rider, { foreignKey: "userId", as: "riderProfile" });
Rider.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(Rider, { foreignKey: "vendorId", as: "managedRiders" });
Rider.belongsTo(User, { foreignKey: "vendorId", as: "vendor" });

User.hasMany(Order, { foreignKey: "userId", as: "orders" });
Order.belongsTo(User, { foreignKey: "userId", as: "user" });

Rider.hasMany(Order, { foreignKey: "riderId", as: "assignedOrders" });
Order.belongsTo(Rider, { foreignKey: "riderId", as: "rider" });

User.hasMany(Product, { foreignKey: "createdBy", as: "createdProducts" });
Product.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
Product.belongsTo(User, { foreignKey: "approvedBy", as: "approver" });
Product.belongsTo(User, { foreignKey: "reviewedBy", as: "reviewer" });
User.hasMany(ProductReview, { foreignKey: "userId", as: "productReviews" });
ProductReview.belongsTo(User, { foreignKey: "userId", as: "author" });
Product.hasMany(ProductReview, { foreignKey: "productId", as: "customerReviews" });
ProductReview.belongsTo(Product, { foreignKey: "productId", as: "product" });

Order.hasMany(OrderItem, { foreignKey: "orderId", as: "items" });
OrderItem.belongsTo(Order, { foreignKey: "orderId", as: "order" });
OrderItem.belongsTo(Product, { foreignKey: "productId", as: "product" });
Order.hasMany(ProductReview, { foreignKey: "orderId", as: "productReviews" });
ProductReview.belongsTo(Order, { foreignKey: "orderId", as: "order" });

Order.hasMany(Notification, { foreignKey: "orderId", as: "notifications" });
Notification.belongsTo(Order, { foreignKey: "orderId", as: "order" });
Notification.hasMany(NotificationEvent, { foreignKey: "notificationId", as: "events" });
NotificationEvent.belongsTo(Notification, { foreignKey: "notificationId", as: "notification" });

Order.hasMany(AuditLog, { foreignKey: "orderId", as: "auditLogs" });
AuditLog.belongsTo(Order, { foreignKey: "orderId", as: "order" });

User.hasMany(VendorPayout, { foreignKey: "vendorId", as: "vendorPayouts" });
VendorPayout.belongsTo(User, { foreignKey: "vendorId", as: "vendor" });
User.hasMany(VendorPayout, { foreignKey: "createdBy", as: "createdPayouts" });
VendorPayout.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
User.hasMany(VendorPayout, { foreignKey: "processedBy", as: "processor" });
VendorPayout.belongsTo(User, { foreignKey: "processedBy", as: "processor" });
Order.hasMany(VendorPayout, { foreignKey: "orderId", as: "vendorPayouts" });
VendorPayout.belongsTo(Order, { foreignKey: "orderId", as: "order" });

export {
  User,
  Rider,
  Product,
  ProductReview,
  Order,
  OrderItem,
  Notification,
  NotificationEvent,
  AuditLog,
  VendorPayout,
};
