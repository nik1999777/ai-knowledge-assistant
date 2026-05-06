import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { createAppError } from "../../utils/app-error.js";

type EvalReportMode = "current" | "seed";

const REPORT_FILES: Record<EvalReportMode, string> = {
  current: "last-report.json",
  seed: "last-seed-report.json",
};

export async function getLatestEvalReport(mode: EvalReportMode = "current") {
  const reportPath = await resolveReportPath(REPORT_FILES[mode]);

  try {
    const raw = await readFile(reportPath, "utf-8");
    return JSON.parse(raw) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw createAppError(
        404,
        mode === "seed"
          ? "Seed eval report не найден. Запустите npm run eval:seed из apps/api"
          : "Eval report не найден. Запустите npm run eval:rag из apps/api",
      );
    }

    throw error;
  }
}

async function resolveReportPath(fileName: string) {
  const reportRelativePath = path.join("test-data", "rag-eval", fileName);
  const candidates = [
    path.resolve(process.cwd(), reportRelativePath),
    path.resolve(process.cwd(), "../..", reportRelativePath),
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
