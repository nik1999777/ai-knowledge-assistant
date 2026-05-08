import path from "node:path";
import { initCollection } from "../clients/qdrant.client.js";
import { runMigrations } from "../db/migrator.js";
import { initPostgres } from "../db/postgres.client.js";
import { generateRagEvalDataset } from "./generate-rag-eval.js";
import { runRagEval } from "./run-rag-eval.js";

async function main() {
  const projectRoot = path.resolve(process.cwd(), "../..");
  const evalDir = path.join(projectRoot, "test-data/rag-eval");
  const datasetPath = path.join(evalDir, "questions.generated.json");
  const reportPath = path.join(evalDir, "last-generated-report.json");

  await initPostgres();
  await runMigrations();
  await initCollection();

  const cases = await generateRagEvalDataset({ datasetPath });

  console.log(`[generated-eval] generated cases=${cases.length}`);

  await runRagEval({
    datasetPath,
    reportPath,
    label: "generated-eval",
    documentScope: "user",
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
