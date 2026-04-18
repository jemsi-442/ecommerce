import { DataTypes } from "sequelize";

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

export const up = async ({ queryInterface, transaction }) => {
  const columns = await getColumnMap(queryInterface, transaction);
  if (!columns || columns.phone) {
    return;
  }

  await queryInterface.addColumn(
    "users",
    "phone",
    {
      type: DataTypes.STRING(40),
      allowNull: true,
      defaultValue: null,
    },
    { transaction }
  );
};

export default { up };
