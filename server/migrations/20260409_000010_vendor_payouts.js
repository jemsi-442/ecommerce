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

export const up = async ({ queryInterface, transaction }) => {
  if (!(await hasTable(queryInterface, "vendor_payouts", transaction))) {
    await queryInterface.sequelize.query(
      `CREATE TABLE vendor_payouts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vendor_id INT NOT NULL,
        order_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        status ENUM('pending','paid','on_hold') NOT NULL DEFAULT 'pending',
        notes TEXT NULL,
        created_by INT NULL,
        processed_by INT NULL,
        paid_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_vendor_payouts_order_vendor (order_id, vendor_id),
        KEY idx_vendor_payouts_vendor_status_created (vendor_id, status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      { transaction }
    );
  }
};

export default { up };
