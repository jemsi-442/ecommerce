const hasUsersTable = async (queryInterface, transaction) => {
  const tables = await queryInterface.showAllTables({ transaction });
  return tables
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : entry.tableName || entry.table_name || Object.values(entry)[0]
    )
    .includes("users");
};

const getColumnMap = async (queryInterface, transaction) => {
  if (!(await hasUsersTable(queryInterface, transaction))) {
    return null;
  }

  return queryInterface.describeTable("users", { transaction });
};

export const up = async ({ queryInterface, sequelize, transaction }) => {
  const columns = await getColumnMap(queryInterface, transaction);
  if (!columns) {
    return;
  }

  if (!columns.store_name) {
    await queryInterface.sequelize.query(
      "ALTER TABLE users ADD COLUMN store_name VARCHAR(120) NULL AFTER active",
      { transaction }
    );
  }

  if (!columns.store_slug) {
    await queryInterface.sequelize.query(
      "ALTER TABLE users ADD COLUMN store_slug VARCHAR(80) NULL UNIQUE AFTER store_name",
      { transaction }
    );
  }

  if (!columns.business_phone) {
    await queryInterface.sequelize.query(
      "ALTER TABLE users ADD COLUMN business_phone VARCHAR(40) NULL AFTER store_slug",
      { transaction }
    );
  }

  if (!columns.business_description) {
    await queryInterface.sequelize.query(
      "ALTER TABLE users ADD COLUMN business_description TEXT NULL AFTER business_phone",
      { transaction }
    );
  }
};

export default { up };
