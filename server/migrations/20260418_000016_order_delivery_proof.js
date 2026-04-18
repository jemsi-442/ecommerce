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

  if (!columns.delivery_proof_recipient) {
    await queryInterface.addColumn(
      "orders",
      "delivery_proof_recipient",
      {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      { transaction }
    );
  }

  if (!columns.delivery_proof_note) {
    await queryInterface.addColumn(
      "orders",
      "delivery_proof_note",
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
