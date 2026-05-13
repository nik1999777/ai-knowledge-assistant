import { API_BASE_URL, apiRequest } from "../../../shared/api/client";
import type {
  ChatSessionDetailResponse,
  ChatSessionSummary,
  ChatSessionsResponse,
  ChatStreamMeta,
  AnswerMode,
} from "../types/chat";

type StreamQuestionHandlers = {
  onChunk: (chunk: string) => void;
};

export async function streamQuestion(
  question: string,
  {
    answerMode,
    onChunk,
    sessionId,
  }: StreamQuestionHandlers & { answerMode: AnswerMode; sessionId?: string },
): Promise<ChatStreamMeta> {
  const res = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ answerMode, question, sessionId }),
  });

  if (!res.ok) {
    const errorText = await res.text();

    try {
      const json = JSON.parse(errorText) as { message?: string };
      throw new Error(json.message || "Ошибка запроса");
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message !== errorText) {
        throw parseError;
      }

      throw new Error(errorText || "Ошибка запроса");
    }
  }

  if (!res.body) {
    throw new Error("Streaming response is unavailable");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let meta: ChatStreamMeta | null = null;

  while (true) {
    const { done, value } = await reader.read();

    buffer += decoder.decode(value, { stream: !done });

    const eventBlocks = buffer.split("\n\n");
    buffer = eventBlocks.pop() ?? "";

    for (const block of eventBlocks) {
      const event = parseStreamEvent(block);

      if (!event) {
        continue;
      }

      if (event.name === "chunk") {
        onChunk(String(event.data.text ?? ""));
        continue;
      }

      if (event.name === "meta") {
        meta = event.data as ChatStreamMeta;
        continue;
      }

      if (event.name === "error") {
        throw new Error(String(event.data.message ?? "Ошибка стриминга"));
      }
    }

    if (done) {
      break;
    }
  }

  const finalEvent = parseStreamEvent(buffer);

  if (finalEvent) {
    if (finalEvent.name === "meta") {
      meta = finalEvent.data as ChatStreamMeta;
    }

    if (finalEvent.name === "error") {
      throw new Error(String(finalEvent.data.message ?? "Ошибка стриминга"));
    }
  }

  if (!meta) {
    throw new Error("Streaming response ended without metadata");
  }

  return meta;
}

export function getChatSessions() {
  return apiRequest<ChatSessionsResponse>("/chat/sessions");
}

export function getChatSessionDetail(
  sessionId: string,
  options: { page: number; pageSize: number },
) {
  const params = new URLSearchParams({
    page: String(options.page),
    pageSize: String(options.pageSize),
  });

  return apiRequest<ChatSessionDetailResponse>(
    `/chat/sessions/${sessionId}?${params.toString()}`,
  );
}

export function createChatSession() {
  return apiRequest<ChatSessionSummary>("/chat/sessions", {
    method: "POST",
  });
}

export function deleteChatSession(sessionId: string) {
  return apiRequest<{ success: true; sessionId: string }>(
    `/chat/sessions/${sessionId}`,
    {
      method: "DELETE",
    },
  );
}

function parseStreamEvent(
  block: string,
): { name: string; data: Record<string, unknown> } | null {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLine = lines.find((line) => line.startsWith("data:"));

  if (!eventLine || !dataLine) {
    return null;
  }

  const name = eventLine.slice("event:".length).trim();
  const json = dataLine.slice("data:".length).trim();

  return {
    name,
    data: JSON.parse(json) as Record<string, unknown>,
  };
}
