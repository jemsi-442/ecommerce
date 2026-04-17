import dotenv from "dotenv";
import sequelize from "../config/db.js";
import { getMigrationStatus } from "../utils/migrations.js";

dotenv.config();

const run = async () => {
  try {
    await sequelize.authenticate();
    const status = await getMigrationStatus();

    if (!status.length) {
      console.log("No migration files found");
      process.exit(0);
    }

    for (const item of status) {
      console.log(`${item.applied ? "applied" : "pending"}\t${item.name}`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Migration status failed:", error.message);
    process.exit(1);
  }
};

run();
