import { readFile } from "node:fs/promises";
import path from "node:path";
import { deleteDocument } from "../modules/documents/document-delete.service.js";
import { ingestUploadedDocument } from "../modules/documents/document-ingest.service.js";
import { initCollection } from "../clients/qdrant.client.js";
import { initPostgres } from "../db/postgres.client.js";
import { runMigrations } from "../db/migrator.js";
import { runRagEval } from "./run-rag-eval.js";
import { SEED_EVAL_DOCS } from "./seed-eval-docs.js";

async function main() {
  const projectRoot = path.resolve(process.cwd(), "../..");
  const seedDocsDir = path.join(projectRoot, "test-data/rag-eval/seed-docs");
  const datasetPath = path.join(projectRoot, "test-data/rag-eval/questions.seed.json");
  const reportPath = path.join(projectRoot, "test-data/rag-eval/last-seed-report.json");

  await initPostgres();
  await runMigrations();
  await initCollection();

  console.log(`[seed] reindexing seed docs, count=${SEED_EVAL_DOCS.length}`);

  for (const seedDoc of SEED_EVAL_DOCS) {
    await deleteDocument(seedDoc.docId).catch(() => undefined);
  }

  for (const seedDoc of SEED_EVAL_DOCS) {
    const filePath = path.join(seedDocsDir, seedDoc.fileName);
    const buffer = await readFile(filePath);
    const result = await ingestUploadedDocument({
      docId: seedDoc.docId,
      documentScope: "eval",
      fileName: seedDoc.fileName,
      mimeType: "text/markdown",
      buffer,
    });

    console.log(
      `[seed] indexed ${result.title} docId=${result.docId} chunks=${result.chunks}`,
    );
  }

  await runRagEval({
    datasetPath,
    reportPath,
    label: "seed-eval",
    allowedSourceDocIds: new Set(SEED_EVAL_DOCS.map((doc) => doc.docId)),
    documentScope: "eval",
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
