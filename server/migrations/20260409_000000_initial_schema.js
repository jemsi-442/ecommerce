import { DataTypes } from "sequelize";

const hasTable = async (queryInterface, tableName, transaction) => {
  const tables = await queryInterface.showAllTables({ transaction });
  return tables
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : entry.tableName || entry.table_name || Object.values(entry)[0]
    )
    .includes(tableName);
};

const createUsersTable = async (queryInterface, transaction) => {
  if (await hasTable(queryInterface, "users", transaction)) return;

  await queryInterface.createTable(
    "users",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false },
      email: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      password: { type: DataTypes.STRING(255), allowNull: false },
      role: {
        type: DataTypes.ENUM("customer", "vendor", "admin", "rider"),
        allowNull: false,
        defaultValue: "customer",
      },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      store_name: { type: DataTypes.STRING(120), allowNull: true, defaultValue: null },
      store_slug: { type: DataTypes.STRING(80), allowNull: true, unique: true, defaultValue: null },
      business_phone: { type: DataTypes.STRING(40), allowNull: true, defaultValue: null },
      business_description: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
      saved_product_ids: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
      favorite_store_slugs: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { transaction }
  );
};

const createRidersTable = async (queryInterface, transaction) => {
  if (await hasTable(queryInterface, "riders", transaction)) return;

  await queryInterface.createTable(
    "riders",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: true },
      name: { type: DataTypes.STRING, allowNull: false },
      phone: { type: DataTypes.STRING, allowNull: false },
      available: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      current_orders: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      last_assigned_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { transaction }
  );
};

const createProductsTable = async (queryInterface, transaction) => {
  if (await hasTable(queryInterface, "products", transaction)) return;

  await queryInterface.createTable(
    "products",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true, defaultValue: "" },
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      image: { type: DataTypes.STRING(255), allowNull: true, defaultValue: null },
      sku: { type: DataTypes.STRING(64), allowNull: true, unique: true },
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      approved_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      approved_by: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      reviewed_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      reviewed_by: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      review_notes: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
      created_by: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { transaction }
  );
};

const createOrdersTable = async (queryInterface, transaction) => {
  if (await hasTable(queryInterface, "orders", transaction)) return;

  await queryInterface.createTable(
    "orders",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM("pending", "paid", "out_for_delivery", "delivered", "cancelled", "refunded"),
        allowNull: false,
        defaultValue: "pending",
      },
      delivery_type: {
        type: DataTypes.ENUM("home", "pickup"),
        allowNull: false,
        defaultValue: "home",
      },
      delivery_address: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      delivery_contact_phone: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      rider_id: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      assigned_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      accepted_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      completed_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      payment_method: { type: DataTypes.STRING, allowNull: false, defaultValue: "mobile_money" },
      payment_provider: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      payment_reference: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      payment_status: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      payment_expires_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      payment_failed_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      payment_failure_reason: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
      inventory_reserved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_paid: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      paid_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      delivered_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { transaction }
  );
};

const createOrderItemsTable = async (queryInterface, transaction) => {
  if (await hasTable(queryInterface, "order_items", transaction)) return;

  await queryInterface.createTable(
    "order_items",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      order_id: { type: DataTypes.INTEGER, allowNull: false },
      product_id: { type: DataTypes.INTEGER, allowNull: false },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    },
    { transaction }
  );
};

const createProductReviewsTable = async (queryInterface, transaction) => {
  if (await hasTable(queryInterface, "product_reviews", transaction)) return;

  await queryInterface.createTable(
    "product_reviews",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      product_id: { type: DataTypes.INTEGER, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      order_id: { type: DataTypes.INTEGER, allowNull: false },
      rating: { type: DataTypes.INTEGER, allowNull: false },
      title: { type: DataTypes.STRING(120), allowNull: true, defaultValue: null },
      comment: { type: DataTypes.TEXT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { transaction }
  );

  await queryInterface.addIndex("product_reviews", ["product_id", "created_at"], {
    name: "idx_product_reviews_product_created",
    transaction,
  });

  await queryInterface.addIndex("product_reviews", ["user_id", "created_at"], {
    name: "idx_product_reviews_user_created",
    transaction,
  });

  await queryInterface.addIndex("product_reviews", ["product_id", "user_id"], {
    name: "uniq_product_reviews_product_user",
    unique: true,
    transaction,
  });
};

const createNotificationsTable = async (queryInterface, transaction) => {
  if (await hasTable(queryInterface, "notifications", transaction)) return;

  await queryInterface.createTable(
    "notifications",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      order_id: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      type: { type: DataTypes.STRING, allowNull: false },
      audience: { type: DataTypes.STRING, allowNull: false, defaultValue: "customer" },
      message: { type: DataTypes.TEXT, allowNull: false },
      phone: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      customer_name: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      rider_name: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      status: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { transaction }
  );
};

const createAuditLogsTable = async (queryInterface, transaction) => {
  if (await hasTable(queryInterface, "audit_logs", transaction)) return;

  await queryInterface.createTable(
    "audit_logs",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      order_id: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      user_id: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      rider_id: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      user_name: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      rider_name: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      type: {
        type: DataTypes.ENUM("status", "delivery", "notification", "refund", "user", "payment"),
        allowNull: false,
      },
      action: { type: DataTypes.STRING, allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      meta: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { transaction }
  );
};

const createNotificationEventsTable = async (queryInterface, transaction) => {
  if (await hasTable(queryInterface, "notification_events", transaction)) return;

  await queryInterface.createTable(
    "notification_events",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      audience: { type: DataTypes.STRING, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      notification_id: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      source_instance: { type: DataTypes.STRING, allowNull: false },
      payload: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { transaction }
  );
};

const createVendorPayoutsTable = async (queryInterface, transaction) => {
  if (await hasTable(queryInterface, "vendor_payouts", transaction)) return;

  await queryInterface.createTable(
    "vendor_payouts",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      vendor_id: { type: DataTypes.INTEGER, allowNull: false },
      order_id: { type: DataTypes.INTEGER, allowNull: false },
      amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM("pending", "paid", "on_hold"),
        allowNull: false,
        defaultValue: "pending",
      },
      notes: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
      created_by: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      processed_by: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      paid_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { transaction }
  );

  await queryInterface.addIndex("vendor_payouts", ["vendor_id", "status", "created_at"], {
    name: "idx_vendor_payouts_vendor_status_created",
    transaction,
  });

  await queryInterface.addIndex("vendor_payouts", ["order_id", "vendor_id"], {
    name: "uniq_vendor_payouts_order_vendor",
    unique: true,
    transaction,
  });
};

const createNotificationIndexes = async (queryInterface, transaction) => {
  await queryInterface.addIndex("notifications", ["audience", "read", "created_at"], {
    name: "idx_notifications_audience_read_created",
    transaction,
  });

  await queryInterface.addIndex("notifications", ["order_id", "audience"], {
    name: "idx_notifications_order_audience",
    transaction,
  });

  await queryInterface.addIndex("notification_events", ["created_at"], {
    name: "idx_notification_events_created_at",
    transaction,
  });

  await queryInterface.addIndex("notification_events", ["source_instance"], {
    name: "idx_notification_events_source_instance",
    transaction,
  });

  await queryInterface.addIndex("notification_events", ["audience", "user_id"], {
    name: "idx_notification_events_audience_user",
    transaction,
  });
};

export const up = async ({ queryInterface, transaction }) => {
  await createUsersTable(queryInterface, transaction);
  await createRidersTable(queryInterface, transaction);
  await createProductsTable(queryInterface, transaction);
  await createOrdersTable(queryInterface, transaction);
  await createOrderItemsTable(queryInterface, transaction);
  await createProductReviewsTable(queryInterface, transaction);
  await createNotificationsTable(queryInterface, transaction);
  await createAuditLogsTable(queryInterface, transaction);
  await createVendorPayoutsTable(queryInterface, transaction);
  await createNotificationEventsTable(queryInterface, transaction);
  await createNotificationIndexes(queryInterface, transaction);
};

export default { up };
