import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { createAppError } from "../../utils/app-error.js";

const REPORT_RELATIVE_PATH = path.join("test-data", "rag-eval", "last-report.json");

export async function getLatestEvalReport() {
  const reportPath = await resolveReportPath();

  try {
    const raw = await readFile(reportPath, "utf-8");
    return JSON.parse(raw) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw createAppError(
        404,
        "Eval report не найден. Запустите npm run eval:rag из apps/api",
      );
    }

    throw error;
  }
}

async function resolveReportPath() {
  const candidates = [
    path.resolve(process.cwd(), REPORT_RELATIVE_PATH),
    path.resolve(process.cwd(), "../..", REPORT_RELATIVE_PATH),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next likely project root.
    }
  }

  return candidates[0];
}
