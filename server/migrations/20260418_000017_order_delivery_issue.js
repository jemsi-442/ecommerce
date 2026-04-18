import { DataTypes } from "sequelize";

const hasOrdersTable = async (queryInterface, transaction) => {
  const tables = await queryInterface.showAllTables({ transaction });
  return tables
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : entry.tableName || entry.table_name || Object.values(entry)[0]
    )
    .includes("orders");
};

const getColumnMap = async (queryInterface, transaction) => {
  if (!(await hasOrdersTable(queryInterface, transaction))) {
    return null;
  }

  return queryInterface.describeTable("orders", { transaction });
};

export const up = async ({ queryInterface, transaction }) => {
  const columns = await getColumnMap(queryInterface, transaction);
  if (!columns) {
    return;
  }

  if (!columns.delivery_issue_reported_at) {
    await queryInterface.addColumn(
      "orders",
      "delivery_issue_reported_at",
      {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      { transaction }
    );
  }

  if (!columns.delivery_issue_reason) {
    await queryInterface.addColumn(
      "orders",
      "delivery_issue_reason",
      {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      },
      { transaction }
    );
  }
};

export default { up };
