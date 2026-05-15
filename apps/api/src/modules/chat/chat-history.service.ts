import {
  createChatSession,
  deleteChatSession,
  getChatMessagesPageBySessionId,
  getChatSessionById,
  getRecentChatMessages,
  listChatSessions,
  saveChatExchange,
} from "../../repositories/chat.repository.js";

import type { ConversationTurn } from "../../services/prompt.service.js";
import type {
  ChatExchangeRecord,
  ChatSessionDetailResponse,
  ChatSessionsResponse,
  ChatStreamMeta,
} from "./chat.types.js";

export async function getChatSessions(): Promise<ChatSessionsResponse> {
  const sessions = await listChatSessions();
  return { sessions };
}

export async function getChatSessionDetail(
  sessionId: string,
  options: { page: number; pageSize: number },
): Promise<ChatSessionDetailResponse> {
  const [session, paged] = await Promise.all([
    getChatSessionById(sessionId),
    getChatMessagesPageBySessionId(sessionId, options.page, options.pageSize),
  ]);

  const totalPages = Math.max(1, Math.ceil(paged.totalExchanges / options.pageSize));

  return {
    session,
    exchanges: buildChatExchanges(session.id, paged.messages),
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      totalExchanges: paged.totalExchanges,
      totalPages,
      hasNextPage: options.page < totalPages,
      hasPreviousPage: options.page > 1,
    },
  };
}

export async function createEmptyChatSession() {
  return createChatSession("Новый диалог");
}

export async function removeChatSession(sessionId: string) {
  await deleteChatSession(sessionId);
}

export async function ensureChatSession(question: string, sessionId?: string) {
  if (sessionId) {
    return getChatSessionById(sessionId);
  }

  return createChatSession(buildSessionTitle(question));
}

export async function loadRecentHistory(
  sessionId: string,
  maxTurns = 3,
): Promise<ConversationTurn[]> {
  const messages = await getRecentChatMessages(sessionId, maxTurns * 2);
  const turns: ConversationTurn[] = [];

  for (let i = 0; i < messages.length - 1; i++) {
    const msg = messages[i];
    const next = messages[i + 1];
    if (msg.role === "user" && next.role === "assistant") {
      turns.push({ question: msg.content, answer: next.content });
      i++;
    }
  }

  return turns;
}

export async function persistChatExchange(
  sessionId: string,
  question: string,
  answer: string,
  meta: ChatStreamMeta,
) {
  await saveChatExchange(
    sessionId,
    question,
    answer,
    buildSessionTitle(question),
    meta,
  );
}

function buildSessionTitle(question: string) {
  const normalized = question.trim().replace(/\s+/g, " ");
  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}

function buildChatExchanges(
  sessionId: string,
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    sources: ChatStreamMeta["sources"];
    bestScore: number | null;
    timing: ChatStreamMeta["timing"] | null;
    debug: ChatStreamMeta["debug"] | null;
    createdAt: string;
  }>,
): ChatExchangeRecord[] {
  const exchanges: ChatExchangeRecord[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const userMessage = messages[index];
    const assistantMessage = messages[index + 1];

    if (!userMessage || userMessage.role !== "user") {
      continue;
    }

    if (!assistantMessage || assistantMessage.role !== "assistant") {
      continue;
    }

    if (
      assistantMessage.bestScore === null ||
      assistantMessage.timing === null ||
      assistantMessage.debug === null
    ) {
      continue;
    }

    exchanges.push({
      id: assistantMessage.id,
      question: userMessage.content,
      status: "success",
      createdAt: userMessage.createdAt,
      response: {
        answer: assistantMessage.content,
        sources: assistantMessage.sources,
        bestScore: assistantMessage.bestScore,
        timing: assistantMessage.timing,
        debug: assistantMessage.debug,
        sessionId,
      },
    });
  }

  return exchanges;
}
