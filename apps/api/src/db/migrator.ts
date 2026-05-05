import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { getPostgresPool } from "./postgres.client.js";

const MIGRATIONS_TABLE = "schema_migrations";

export async function runMigrations() {
  const pool = getPostgresPool();
  const migrationsDir = getMigrationsDir();
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id BIGSERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  try {
    for (const file of files) {
      const alreadyApplied = await isMigrationApplied(client, file);

      if (alreadyApplied) {
        continue;
      }

      const sql = await readFile(path.join(migrationsDir, file), "utf-8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1)`,
          [file],
        );
        await client.query("COMMIT");
        console.log(`[migrations] applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }
}

async function isMigrationApplied(client: PoolClient, filename: string) {
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS(
        SELECT 1
        FROM ${MIGRATIONS_TABLE}
        WHERE filename = $1
      ) AS exists
    `,
    [filename],
  );

  return Boolean(result.rows[0]?.exists);
}

function getMigrationsDir() {
  return path.resolve(process.cwd(), "src/db/migrations");
}
