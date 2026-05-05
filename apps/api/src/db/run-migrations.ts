import { initPostgres } from "./postgres.client.js";
import { runMigrations } from "./migrator.js";

async function main() {
  await initPostgres();
  await runMigrations();
  console.log("[migrations] done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
