import dotenv from "dotenv";
import { Sequelize } from "sequelize";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || process.env.MARIADB_URL || null;

const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, {
      dialect: "mariadb",
      logging: false,
      dialectOptions: {
        connectTimeout: 10000,
      },
    })
  : new Sequelize(
      process.env.DB_NAME || "rihancollection",
      process.env.DB_USER || "root",
      process.env.DB_PASSWORD || "",
      {
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT || 3306),
        dialect: "mariadb",
        logging: false,
        dialectOptions: {
          connectTimeout: 10000,
        },
      }
    );

export const connectDB = async () => {
  await sequelize.authenticate();
  await sequelize.sync();
};

export default sequelize;
