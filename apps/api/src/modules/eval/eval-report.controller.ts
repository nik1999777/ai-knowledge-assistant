import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getLatestEvalReport } from "./eval-report.service.js";

const evalReportQuerySchema = z.object({
  mode: z.enum(["current", "seed"]).default("current"),
});

export async function registerEvalRoutes(app: FastifyInstance) {
  app.get("/eval/report", async (request) => {
    const query = evalReportQuerySchema.parse(request.query);
    return getLatestEvalReport(query.mode);
  });
}
