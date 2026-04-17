import { DataTypes } from "sequelize";

const hasColumn = async (queryInterface, tableName, columnName, transaction) => {
  const table = await queryInterface.describeTable(tableName, { transaction });
  return Object.prototype.hasOwnProperty.call(table, columnName);
};

export const up = async ({ queryInterface, transaction }) => {
  if (!(await hasColumn(queryInterface, "users", "saved_product_ids", transaction))) {
    await queryInterface.addColumn(
      "users",
      "saved_product_ids",
      {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "[]",
      },
      { transaction }
    );
  }
};

export default { up };
