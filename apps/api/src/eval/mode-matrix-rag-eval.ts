import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { initCollection } from "../clients/qdrant.client.js";
import { runMigrations } from "../db/migrator.js";
import { initPostgres } from "../db/postgres.client.js";
import { deleteDocument } from "../modules/documents/document-delete.service.js";
import { ingestUploadedDocument } from "../modules/documents/document-ingest.service.js";
import {
  runRagEval,
  type RagEvalAnswerMode,
} from "./run-rag-eval.js";
import { SEED_EVAL_DOCS } from "./seed-eval-docs.js";

const ANSWER_MODES: RagEvalAnswerMode[] = ["strict", "balanced", "tutor"];

async function main() {
  const projectRoot = path.resolve(process.cwd(), "../..");
  const seedDocsDir = path.join(projectRoot, "test-data/rag-eval/seed-docs");
  const datasetPath = path.join(projectRoot, "test-data/rag-eval/questions.seed.json");
  const evalDir = path.join(projectRoot, "test-data/rag-eval");
  const reportPath = path.join(evalDir, "last-mode-matrix-report.json");

  await initPostgres();
  await runMigrations();
  await initCollection();

  console.log(`[mode-matrix] reindexing seed docs, count=${SEED_EVAL_DOCS.length}`);

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
      `[mode-matrix] indexed ${result.title} docId=${result.docId} chunks=${result.chunks}`,
    );
  }

  const modes = [];

  for (const answerMode of ANSWER_MODES) {
    const modeReportPath = path.join(
      evalDir,
      `last-mode-matrix-${answerMode}-report.json`,
    );
    const report = await runRagEval({
      answerMode,
      datasetPath,
      reportPath: modeReportPath,
      label: `mode-matrix:${answerMode}`,
      allowedSourceDocIds: new Set(SEED_EVAL_DOCS.map((doc) => doc.docId)),
      documentScope: "eval",
    });

    modes.push({
      answerMode,
      summary: report.summary,
      failedResults: report.results.filter((result) => !result.answerabilityCorrect),
      results: report.results,
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    dataset: "seed",
    modes,
  };

  await writeFile(reportPath, JSON.stringify(payload, null, 2), "utf-8");

  console.log(`[mode-matrix] done`);
  for (const mode of modes) {
    console.log(
      `[mode-matrix] ${mode.answerMode} accuracy=${mode.summary.answerabilityAccuracy.toFixed(3)} decline_rate=${mode.summary.declineRate.toFixed(3)} fp=${mode.summary.confusion.fp} fn=${mode.summary.confusion.fn} tp=${mode.summary.confusion.tp} tn=${mode.summary.confusion.tn}`,
    );
  }
  console.log(`[mode-matrix] report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
