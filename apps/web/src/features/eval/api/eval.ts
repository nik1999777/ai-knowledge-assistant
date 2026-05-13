import { apiRequest } from "../../../shared/api/client";
import type { EvalReport } from "../types/eval";

export type EvalReportMode = "generated" | "seed";

export function getEvalReport(mode: EvalReportMode) {
  return apiRequest<EvalReport>(`/eval/report?mode=${mode}`);
}
