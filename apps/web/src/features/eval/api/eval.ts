import { apiRequest } from "../../../shared/api/client";
import type { EvalReport } from "../types/eval";

export function getEvalReport() {
  return apiRequest<EvalReport>("/eval/report");
}
