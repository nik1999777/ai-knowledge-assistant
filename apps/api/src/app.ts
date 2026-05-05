import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { registerChatRoutes } from "./modules/chat/chat.controller.js";
import { registerDocumentRoutes } from "./modules/documents/documents.controller.js";
import { registerEvalRoutes } from "./modules/eval/eval-report.controller.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { env } from "./config/env.js";
import { getReadiness } from "./system/readiness.service.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
    },
  });

  await registerErrorHandler(app);

  app.get("/health", async () => {
    return {
      status: "ok",
      uptimeSec: Math.round(process.uptime()),
    };
  });

  app.get("/ready", async (_request, reply) => {
    const readiness = await getReadiness();

    if (readiness.status === "ready") {
      return readiness;
    }

    return reply.status(503).send(readiness);
  });

  await registerChatRoutes(app);
  await registerDocumentRoutes(app);
  await registerEvalRoutes(app);

  return app;
}
