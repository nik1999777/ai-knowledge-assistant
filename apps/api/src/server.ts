import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { initCollection } from "./clients/qdrant.client.js";
import { runMigrations } from "./db/migrator.js";
import { initPostgres } from "./db/postgres.client.js";

async function start() {
  try {
    await initPostgres();
    await runMigrations();
    await initCollection();

    const app = await buildApp();

    const port = env.PORT;

    await app.listen({
      port,
      host: "0.0.0.0",
    });

    console.log(`API running on http://localhost:${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
