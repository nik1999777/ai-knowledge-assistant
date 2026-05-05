import { Pool } from "pg";
import { env } from "../config/env.js";

const pool = new Pool({
  connectionString: env.POSTGRES_URL,
});

export async function initPostgres() {
  await pool.query("SELECT 1");
}

export function getPostgresPool() {
  return pool;
}

export async function checkPostgresConnection() {
  await pool.query("SELECT 1");
}
