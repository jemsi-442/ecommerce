import { DataTypes } from "sequelize";

const hasRidersTable = async (queryInterface, transaction) => {
  const tables = await queryInterface.showAllTables({ transaction });
  return tables
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : entry.tableName || entry.table_name || Object.values(entry)[0]
    )
    .includes("riders");
};

const getColumnMap = async (queryInterface, transaction) => {
  if (!(await hasRidersTable(queryInterface, transaction))) {
    return null;
  }

  return queryInterface.describeTable("riders", { transaction });
};

export const up = async ({ queryInterface, transaction }) => {
  const columns = await getColumnMap(queryInterface, transaction);
  if (!columns || columns.vendor_id) {
    return;
  }

  await queryInterface.addColumn(
    "riders",
    "vendor_id",
    {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    { transaction }
  );
};

export default { up };
