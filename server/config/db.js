import dotenv from "dotenv";
import { Sequelize } from "sequelize";

dotenv.config();
const isProduction = process.env.NODE_ENV === "production";
const shouldSync = !isProduction && process.env.DB_SYNC === "true";
const shouldAlter =
  shouldSync &&
  (process.env.DB_SYNC_ALTER === "true" ||
    (!isProduction && process.env.DB_SYNC_ALTER !== "false"));

const isTemplateValue = (value = "") =>
  !value || value.includes("${{") || value.startsWith("replace_with_") || value.includes("<");

const resolveDatabaseUrl = (...candidates) => {
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (isTemplateValue(value)) continue;

    try {
      const parsed = new URL(value);
      if (parsed.protocol) {
        return value;
      }
    } catch (error) {
      continue;
    }
  }

  return null;
};

const databaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL, process.env.MARIADB_URL);

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

  if (!shouldSync) {
    return;
  }

  await sequelize.sync({ alter: shouldAlter });
};

export default sequelize;
