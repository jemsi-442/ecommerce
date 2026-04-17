const columnExists = async (queryInterface, tableName, columnName, transaction) => {
  const definition = await queryInterface.describeTable(tableName, { transaction });
  return Object.prototype.hasOwnProperty.call(definition, columnName);
};

export const up = async ({ queryInterface, sequelize, transaction }) => {
  const addColumnIfMissing = async (tableName, columnName, attributes) => {
    if (await columnExists(queryInterface, tableName, columnName, transaction)) {
      return;
    }

    await queryInterface.addColumn(tableName, columnName, attributes, { transaction });
  };

  await addColumnIfMissing("orders", "payment_provider", {
    type: sequelize.Sequelize.DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
  });

  await addColumnIfMissing("orders", "payment_reference", {
    type: sequelize.Sequelize.DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
  });

  await addColumnIfMissing("orders", "payment_status", {
    type: sequelize.Sequelize.DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
  });

  await addColumnIfMissing("orders", "payment_expires_at", {
    type: sequelize.Sequelize.DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  });

  await addColumnIfMissing("orders", "payment_failed_at", {
    type: sequelize.Sequelize.DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  });

  await addColumnIfMissing("orders", "payment_failure_reason", {
    type: sequelize.Sequelize.DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  });

  await addColumnIfMissing("orders", "inventory_reserved", {
    type: sequelize.Sequelize.DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });
};

export default { up };
