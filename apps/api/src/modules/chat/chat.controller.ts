import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { env } from "../../config/env.js";
import { createSseStream } from "../../utils/sse.js";
import {
  chatSchema,
  chatSessionParamsSchema,
  chatSessionQuerySchema,
} from "./chat.schemas.js";
import {
  createEmptyChatSession,
  ensureChatSession,
  getChatSessionDetail,
  getChatSessions,
  loadRecentHistory,
  persistChatExchange,
  removeChatSession,
} from "./chat-history.service.js";
import { streamChatWithKnowledgeBase } from "./chat.service.js";

export async function registerChatRoutes(app: FastifyInstance) {
  app.get("/chat/sessions", async () => getChatSessions());

  app.post("/chat/sessions", async () => createEmptyChatSession());

  app.get(
    "/chat/sessions/:sessionId",
    async (request: FastifyRequest) => {
      const params = chatSessionParamsSchema.parse(request.params);
      const query = chatSessionQuerySchema.parse(request.query);
      return getChatSessionDetail(params.sessionId, query);
    },
  );

  app.delete(
    "/chat/sessions/:sessionId",
    async (request: FastifyRequest) => {
      const params = chatSessionParamsSchema.parse(request.params);
      await removeChatSession(params.sessionId);
      return { success: true as const, sessionId: params.sessionId };
    },
  );

  app.post("/chat/stream", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = chatSchema.parse(request.body);
    const stream = createSseStream(reply, env.WEB_ORIGIN);

    try {
      const session = await ensureChatSession(body.question, body.sessionId);
      const history = await loadRecentHistory(session.id);
      const result = await streamChatWithKnowledgeBase(body, (chunk) => {
        stream.send("chunk", { text: chunk });
      }, { history });

      const meta = {
        ...result.meta,
        sessionId: session.id,
      };

      await persistChatExchange(session.id, body.question, result.answer, meta);

      stream.send("meta", meta);
      stream.send("done", {});
    } catch (error) {
      app.log.error(error);

      stream.send("error", {
        message:
          error instanceof Error ? error.message : "Внутренняя ошибка сервера",
      });
    } finally {
      stream.close();
    }
  });
}
