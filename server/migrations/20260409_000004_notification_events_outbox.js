import { DataTypes } from "sequelize";

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
  if (await hasTable(queryInterface, "notification_events", transaction)) {
    return;
  }

  await queryInterface.createTable(
    "notification_events",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      audience: { type: DataTypes.STRING, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      notification_id: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      source_instance: { type: DataTypes.STRING, allowNull: false },
      payload: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { transaction }
  );
};

export default { up };
