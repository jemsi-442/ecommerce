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

const hasIndex = async (queryInterface, tableName, indexName, transaction) => {
  const indexes = await queryInterface.showIndex(tableName, { transaction });
  return indexes.some((index) => index.name === indexName);
};

export const up = async ({ queryInterface, transaction }) => {
  if (!(await hasTable(queryInterface, "product_reviews", transaction))) {
    await queryInterface.createTable(
      "product_reviews",
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        product_id: { type: DataTypes.INTEGER, allowNull: false },
        user_id: { type: DataTypes.INTEGER, allowNull: false },
        order_id: { type: DataTypes.INTEGER, allowNull: false },
        rating: { type: DataTypes.INTEGER, allowNull: false },
        title: { type: DataTypes.STRING(120), allowNull: true, defaultValue: null },
        comment: { type: DataTypes.TEXT, allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      },
      { transaction }
    );
  }

  if (!(await hasIndex(queryInterface, "product_reviews", "idx_product_reviews_product_created", transaction))) {
    await queryInterface.addIndex("product_reviews", ["product_id", "created_at"], {
      name: "idx_product_reviews_product_created",
      transaction,
    });
  }

  if (!(await hasIndex(queryInterface, "product_reviews", "idx_product_reviews_user_created", transaction))) {
    await queryInterface.addIndex("product_reviews", ["user_id", "created_at"], {
      name: "idx_product_reviews_user_created",
      transaction,
    });
  }

  if (!(await hasIndex(queryInterface, "product_reviews", "uniq_product_reviews_product_user", transaction))) {
    await queryInterface.addIndex("product_reviews", ["product_id", "user_id"], {
      name: "uniq_product_reviews_product_user",
      unique: true,
      transaction,
    });
  }
};

export default { up };
