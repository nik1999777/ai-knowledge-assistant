import { getPostgresPool } from "../db/postgres.client.js";
import { createAppError } from "../utils/app-error.js";

import type { RagDebug, RagSource, RagTiming } from "../modules/chat/chat.types.js";

const pool = getPostgresPool();
const DEFAULT_SESSION_TITLE = "Новый диалог";

type ChatSessionRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type ChatMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: RagSource[] | null;
  best_score: number | null;
  timing: RagTiming | null;
  debug: RagDebug | null;
  created_at: string;
};

export async function createChatSession(title: string) {
  const sessionId = crypto.randomUUID();

  await pool.query(
    `
      INSERT INTO chat_sessions (id, title)
      VALUES ($1, $2)
    `,
    [sessionId, title],
  );

  return getChatSessionById(sessionId);
}

export async function listChatSessions() {
  const result = await pool.query<ChatSessionRow>(`
    SELECT id, title, created_at::text, updated_at::text
    FROM chat_sessions
    ORDER BY updated_at DESC
  `);

  return result.rows.map(mapSessionRow);
}

export async function getChatSessionById(sessionId: string) {
  const result = await pool.query<ChatSessionRow>(
    `
      SELECT id, title, created_at::text, updated_at::text
      FROM chat_sessions
      WHERE id = $1
      LIMIT 1
    `,
    [sessionId],
  );

  const row = result.rows[0];

  if (!row) {
    throw createAppError(404, "Чат-сессия не найдена");
  }

  return mapSessionRow(row);
}

export async function getChatMessagesBySessionId(sessionId: string) {
  await getChatSessionById(sessionId);

  const result = await pool.query<ChatMessageRow>(
    `
      SELECT
        id,
        role,
        content,
        sources,
        best_score,
        timing,
        debug,
        created_at::text
      FROM chat_messages
      WHERE session_id = $1
      ORDER BY created_at ASC
    `,
    [sessionId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    sources: Array.isArray(row.sources) ? row.sources : [],
    bestScore: row.best_score,
    timing: row.timing,
    debug: row.debug,
    createdAt: row.created_at,
  }));
}

export async function getChatMessagesPageBySessionId(
  sessionId: string,
  page: number,
  pageSize: number,
) {
  await getChatSessionById(sessionId);

  const limit = pageSize * 2;
  const offset = (page - 1) * limit;

  const [countResult, result] = await Promise.all([
    pool.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM chat_messages
        WHERE session_id = $1
          AND role = 'assistant'
      `,
      [sessionId],
    ),
    pool.query<ChatMessageRow>(
      `
        SELECT *
        FROM (
          SELECT
            id,
            role,
            content,
            sources,
            best_score,
            timing,
            debug,
            created_at::text
          FROM chat_messages
          WHERE session_id = $1
          ORDER BY created_at DESC
          LIMIT $2
          OFFSET $3
        ) paged
        ORDER BY created_at ASC
      `,
      [sessionId, limit, offset],
    ),
  ]);

  return {
    totalExchanges: Number(countResult.rows[0]?.total ?? 0),
    messages: result.rows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      sources: Array.isArray(row.sources) ? row.sources : [],
      bestScore: row.best_score,
      timing: row.timing,
      debug: row.debug,
      createdAt: row.created_at,
    })),
  };
}

export async function getRecentChatMessages(sessionId: string, limit: number) {
  const result = await pool.query<Pick<ChatMessageRow, "role" | "content">>(
    `SELECT role, content
     FROM chat_messages
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [sessionId, limit],
  );
  return result.rows.reverse() as Array<{ role: "user" | "assistant"; content: string }>;
}

export async function deleteChatSession(sessionId: string) {
  await getChatSessionById(sessionId);
  await pool.query("DELETE FROM chat_sessions WHERE id = $1", [sessionId]);
}

export async function saveChatExchange(
  sessionId: string,
  question: string,
  answer: string,
  nextSessionTitle: string,
  meta: {
    sources: RagSource[];
    bestScore: number;
    timing: RagTiming;
    debug: RagDebug;
  },
) {
  await getChatSessionById(sessionId);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        INSERT INTO chat_messages (id, session_id, role, content)
        VALUES ($1, $2, 'user', $3)
      `,
      [crypto.randomUUID(), sessionId, question],
    );

    await client.query(
      `
        INSERT INTO chat_messages (
          id,
          session_id,
          role,
          content,
          sources,
          best_score,
          timing,
          debug
        )
        VALUES ($1, $2, 'assistant', $3, $4::jsonb, $5, $6::jsonb, $7::jsonb)
      `,
      [
        crypto.randomUUID(),
        sessionId,
        answer,
        JSON.stringify(meta.sources),
        meta.bestScore,
        JSON.stringify(meta.timing),
        JSON.stringify(meta.debug),
      ],
    );

    await client.query(
      `
        UPDATE chat_sessions
        SET
          title = CASE
            WHEN title = $2 THEN $3
            ELSE title
          END,
          updated_at = NOW()
        WHERE id = $1
      `,
      [sessionId, DEFAULT_SESSION_TITLE, nextSessionTitle],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function mapSessionRow(row: ChatSessionRow) {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
