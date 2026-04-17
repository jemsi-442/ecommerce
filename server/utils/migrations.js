import fs from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { QueryTypes } from "sequelize";
import sequelize from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../migrations");
const migrationTableName = "schema_migrations";

const ensureMigrationTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS ${migrationTableName} (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const getAppliedMigrationNames = async () => {
  await ensureMigrationTable();
  const rows = await sequelize.query(
    `SELECT name FROM ${migrationTableName} ORDER BY applied_at ASC, name ASC`,
    { type: QueryTypes.SELECT }
  );

  return new Set(rows.map((row) => row.name));
};

const getMigrationFiles = async () => {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => entry.name)
    .sort();
};

const loadMigration = async (filename) => {
  const fileUrl = pathToFileURL(path.join(migrationsDir, filename)).href;
  const migrationModule = await import(fileUrl);
  return migrationModule.default || migrationModule;
};

export const getMigrationStatus = async () => {
  const [appliedNames, files] = await Promise.all([
    getAppliedMigrationNames(),
    getMigrationFiles(),
  ]);

  return files.map((name) => ({
    name,
    applied: appliedNames.has(name),
  }));
};

export const runMigrations = async ({ logger = console } = {}) => {
  await ensureMigrationTable();
  const appliedNames = await getAppliedMigrationNames();
  const files = await getMigrationFiles();
  const appliedThisRun = [];

  for (const filename of files) {
    if (appliedNames.has(filename)) {
      continue;
    }

    const migration = await loadMigration(filename);

    if (typeof migration.up !== "function") {
      throw new Error(`Migration ${filename} is missing an up() function`);
    }

    logger.log(`Running migration ${filename}...`);

    await sequelize.transaction(async (transaction) => {
      const queryInterface = sequelize.getQueryInterface();
      await migration.up({ sequelize, queryInterface, transaction });
      await sequelize.query(
        `INSERT INTO ${migrationTableName} (name) VALUES (:name)`,
        {
          replacements: { name: filename },
          transaction,
        }
      );
    });

    appliedThisRun.push(filename);
    logger.log(`Applied migration ${filename}`);
  }

  if (!appliedThisRun.length) {
    logger.log("No pending migrations");
  }

  return appliedThisRun;
};
