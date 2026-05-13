import { apiRequest } from "../../../shared/api/client";
import type { EvalReportResponse } from "../types/eval";

export type EvalReportMode = "generated" | "modes" | "seed";

export function getEvalReport(mode: EvalReportMode) {
  return apiRequest<EvalReportResponse>(`/eval/report?mode=${mode}`);
}
