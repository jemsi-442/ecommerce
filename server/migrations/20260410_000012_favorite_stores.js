import { DataTypes } from "sequelize";

const hasColumn = async (queryInterface, tableName, columnName, transaction) => {
  const table = await queryInterface.describeTable(tableName, { transaction });
  return Object.prototype.hasOwnProperty.call(table, columnName);
};

export const up = async ({ queryInterface, transaction }) => {
  if (!(await hasColumn(queryInterface, "users", "favorite_store_slugs", transaction))) {
    await queryInterface.addColumn(
      "users",
      "favorite_store_slugs",
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
