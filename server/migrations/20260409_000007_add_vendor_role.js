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

export const up = async ({ queryInterface, transaction }) => {
  if (!(await hasUsersTable(queryInterface, transaction))) {
    return;
  }

  await queryInterface.sequelize.query(
    "ALTER TABLE users MODIFY COLUMN role ENUM('customer','vendor','admin','rider') NOT NULL DEFAULT 'customer'",
    { transaction }
  );
};

export default { up };
