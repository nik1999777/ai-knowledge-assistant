import type { FastifyInstance } from "fastify";
import { getLatestEvalReport } from "./eval-report.service.js";

export async function registerEvalRoutes(app: FastifyInstance) {
  app.get("/eval/report", async () => getLatestEvalReport());
}
