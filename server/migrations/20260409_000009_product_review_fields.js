const hasProductsTable = async (queryInterface, transaction) => {
  const tables = await queryInterface.showAllTables({ transaction });
  return tables
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : entry.tableName || entry.table_name || Object.values(entry)[0]
    )
    .includes("products");
};

const getColumnMap = async (queryInterface, transaction) => {
  if (!(await hasProductsTable(queryInterface, transaction))) {
    return null;
  }

  return queryInterface.describeTable("products", { transaction });
};

export const up = async ({ queryInterface, transaction }) => {
  const columns = await getColumnMap(queryInterface, transaction);
  if (!columns) {
    return;
  }

  if (!columns.reviewed_at) {
    await queryInterface.sequelize.query(
      "ALTER TABLE products ADD COLUMN reviewed_at DATETIME NULL AFTER approved_by",
      { transaction }
    );
  }

  if (!columns.reviewed_by) {
    await queryInterface.sequelize.query(
      "ALTER TABLE products ADD COLUMN reviewed_by INT NULL AFTER reviewed_at",
      { transaction }
    );
  }

  if (!columns.review_notes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE products ADD COLUMN review_notes TEXT NULL AFTER reviewed_by",
      { transaction }
    );
  }
};

export default { up };
