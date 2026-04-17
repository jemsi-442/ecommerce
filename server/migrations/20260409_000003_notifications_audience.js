import { DataTypes } from "sequelize";

const hasColumn = async (queryInterface, tableName, columnName, transaction) => {
  const definition = await queryInterface.describeTable(tableName, { transaction });
  return Boolean(definition[columnName]);
};

export const up = async ({ queryInterface, transaction }) => {
  if (!(await hasColumn(queryInterface, "notifications", "audience", transaction))) {
    await queryInterface.addColumn(
      "notifications",
      "audience",
      {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "customer",
      },
      { transaction }
    );
  }

  await queryInterface.sequelize.query(
    `
      UPDATE notifications
      SET audience = CASE
        WHEN type LIKE 'admin_%' THEN 'admin'
        ELSE 'customer'
      END
      WHERE audience IS NULL OR audience = ''
    `,
    { transaction }
  );
};

export default { up };
