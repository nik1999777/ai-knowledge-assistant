import { getPostgresPool } from "../db/postgres.client.js";
import { createAppError } from "../utils/app-error.js";
import { tokenizeForSearch } from "../utils/tokenization.js";

const pool = getPostgresPool();

export type DocumentSourceType = "txt" | "md" | "pdf" | "docx" | "csv" | "zip";
export type DocumentScope = "user" | "eval";

export type CreateDocumentInput = {
  docId: string;
  documentScope?: DocumentScope;
  title: string;
  sourceType: DocumentSourceType;
  originalFileName: string;
  textContent: string;
  rawTextContent: string;
  characters: number;
  chunksCount: number;
  warnings: string[];
};

export type ListDocumentsInput = {
  scope?: DocumentScope;
  query?: string;
};

export type LexicalDocumentMatch = {
  docId: string;
  documentScope: DocumentScope;
  title: string;
  sourceType: DocumentSourceType;
  textContent: string;
  lexicalRank: number;
};

export type LexicalChunkMatch = {
  docId: string;
  title: string;
  sourceType: DocumentSourceType;
  chunkIndex: number;
  section: string | null;
  chunkText: string;
  chunkLen: number;
  startOffset: number;
  endOffset: number;
  lexicalRank: number;
};

export type DocumentChunkInput = {
  docId: string;
  documentScope: DocumentScope;
  chunkIndex: number;
  section: string | null;
  chunkText: string;
  chunkLen: number;
  startOffset: number;
  endOffset: number;
};

export type EvalDocument = {
  docId: string;
  documentScope: DocumentScope;
  title: string;
  sourceType: DocumentSourceType;
  textContent: string;
};

type DocumentRow = {
  doc_id: string;
  document_scope: DocumentScope;
  title: string;
  source_type: DocumentSourceType;
  original_file_name: string;
  text_content: string;
  raw_text_content: string;
  characters: number;
  chunks_count: number;
  warnings: string[];
  created_at: string;
  updated_at: string;
};

export async function createDocument(input: CreateDocumentInput) {
  await pool.query(
    `
      INSERT INTO documents (
        doc_id,
        document_scope,
        title,
        source_type,
        original_file_name,
        text_content,
        raw_text_content,
        characters,
        chunks_count,
        warnings
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    `,
    [
      input.docId,
      input.documentScope ?? "user",
      input.title,
      input.sourceType,
      input.originalFileName,
      input.textContent,
      input.rawTextContent,
      input.characters,
      input.chunksCount,
      JSON.stringify(input.warnings),
    ],
  );
}

export async function deleteDocumentRecordByDocId(docId: string) {
  await pool.query("DELETE FROM documents WHERE doc_id = $1", [docId]);
}

export async function listDocuments(input: ListDocumentsInput = {}) {
  const scope = input.scope ?? "user";
  const trimmedQuery = input.query?.trim();
  const tokens = trimmedQuery ? tokenizeLexicalQuery(trimmedQuery) : [];
  const tsQuery = tokens.length > 0 ? buildTsQuery(tokens, "relaxed") : null;

  const result = tsQuery
    ? await pool.query<{ doc_id: string; title: string }>(
        `
          SELECT doc_id, title
          FROM documents
          WHERE document_scope = $2
            AND search_vector @@ to_tsquery('simple', $1)
          ORDER BY
            ts_rank_cd(search_vector, to_tsquery('simple', $1)) DESC,
            updated_at DESC
        `,
        [tsQuery, scope],
      )
    : await pool.query<{ doc_id: string; title: string }>(`
        SELECT doc_id, title
        FROM documents
        WHERE document_scope = $1
        ORDER BY updated_at DESC
      `, [scope]);

  return result.rows.map((row) => ({
    docId: row.doc_id,
    title: row.title,
  }));
}

export async function getDocumentByDocId(docId: string) {
  const result = await pool.query<DocumentRow>(
    `
      SELECT
        doc_id,
        document_scope,
        title,
        source_type,
        original_file_name,
        text_content,
        raw_text_content,
        characters,
        chunks_count,
        warnings,
        created_at::text,
        updated_at::text
      FROM documents
      WHERE doc_id = $1
      LIMIT 1
    `,
    [docId],
  );

  const row = result.rows[0];

  if (!row) {
    throw createAppError(404, "Документ не найден");
  }

  return {
    docId: row.doc_id,
    documentScope: row.document_scope,
    title: row.title,
    sourceType: row.source_type,
    originalFileName: row.original_file_name,
    textContent: row.text_content,
    rawTextContent: row.raw_text_content,
    characters: row.characters,
    chunksCount: row.chunks_count,
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getExistingDocumentIds(docIds: string[]) {
  return getExistingDocumentIdsByScope(docIds, "user");
}

export async function getExistingDocumentIdsByScope(
  docIds: string[],
  scope: DocumentScope,
) {
  if (docIds.length === 0) {
    return new Set<string>();
  }

  const result = await pool.query<{ doc_id: string }>(
    `
      SELECT doc_id
      FROM documents
      WHERE document_scope = $2
        AND doc_id = ANY($1::text[])
    `,
    [docIds, scope],
  );

  return new Set(result.rows.map((row) => row.doc_id));
}

export async function searchDocumentsLexical(
  query: string,
  limit = 8,
  scope: DocumentScope = "user",
): Promise<LexicalDocumentMatch[]> {
  const normalizedQuery = query.trim();
  const tokens = tokenizeLexicalQuery(normalizedQuery);
  const strictTsQuery = buildTsQuery(tokens, "strict");
  const relaxedTsQuery = buildTsQuery(tokens, "relaxed");

  if (
    !normalizedQuery ||
    tokens.length === 0 ||
    strictTsQuery.length === 0 ||
    relaxedTsQuery.length === 0
  ) {
    return [];
  }

  const result = await pool.query<{
    doc_id: string;
    document_scope: DocumentScope;
    title: string;
    source_type: DocumentSourceType;
    text_content: string;
    lexical_rank: number;
  }>(
    `
      SELECT
        d.doc_id,
        d.document_scope,
        d.title,
        d.source_type,
        d.text_content,
        (
          ts_rank_cd(d.search_vector, to_tsquery('simple', $2)) +
          ts_rank_cd(d.search_vector, to_tsquery('simple', $1)) * 0.12 +
          CASE
            WHEN d.title ILIKE $3 THEN 0.15
            WHEN d.original_file_name ILIKE $3 THEN 0.08
            ELSE 0
          END
        ) AS lexical_rank
      FROM documents d
      WHERE d.document_scope = $5
        AND d.search_vector @@ to_tsquery('simple', $2)
      ORDER BY lexical_rank DESC, updated_at DESC
      LIMIT $4
    `,
    [strictTsQuery, relaxedTsQuery, `%${normalizedQuery}%`, limit, scope],
  );

  return result.rows.map((row) => ({
    docId: row.doc_id,
    documentScope: row.document_scope,
    title: row.title,
    sourceType: row.source_type,
    textContent: row.text_content,
    lexicalRank: Number(row.lexical_rank ?? 0),
  }));
}

export async function listDocumentsForEval(
  scope: DocumentScope = "user",
): Promise<EvalDocument[]> {
  const result = await pool.query<{
    doc_id: string;
    document_scope: DocumentScope;
    title: string;
    source_type: DocumentSourceType;
    text_content: string;
  }>(
    `
      SELECT doc_id, document_scope, title, source_type, text_content
      FROM documents
      WHERE document_scope = $1
      ORDER BY updated_at DESC
    `,
    [scope],
  );

  return result.rows.map((row) => ({
    docId: row.doc_id,
    documentScope: row.document_scope,
    title: row.title,
    sourceType: row.source_type,
    textContent: row.text_content,
  }));
}

export async function saveDocumentChunks(chunks: DocumentChunkInput[]) {
  if (chunks.length === 0) return;

  const values = chunks
    .map(
      (_, i) =>
        `($${i * 9 + 1}, $${i * 9 + 2}, $${i * 9 + 3}, $${i * 9 + 4}, $${i * 9 + 5}, $${i * 9 + 6}, $${i * 9 + 7}, $${i * 9 + 8}, to_tsvector('simple', $${i * 9 + 9}))`,
    )
    .join(", ");

  const params = chunks.flatMap((c) => [
    c.docId,
    c.documentScope,
    c.chunkIndex,
    c.section,
    c.chunkLen,
    c.startOffset,
    c.endOffset,
    c.chunkText,
    c.chunkText,
  ]);

  await pool.query(
    `INSERT INTO document_chunks
      (doc_id, document_scope, chunk_index, section, chunk_len, start_offset, end_offset, chunk_text, search_vector)
     VALUES ${values}
     ON CONFLICT (doc_id, chunk_index) DO NOTHING`,
    params,
  );
}

export async function deleteDocumentChunks(docId: string) {
  await pool.query("DELETE FROM document_chunks WHERE doc_id = $1", [docId]);
}

export async function searchDocumentChunksLexical(
  query: string,
  limit = 32,
  scope: DocumentScope = "user",
): Promise<LexicalChunkMatch[]> {
  const tokens = tokenizeLexicalQuery(query);
  const strictTsQuery = buildTsQuery(tokens, "strict");
  const relaxedTsQuery = buildTsQuery(tokens, "relaxed");

  if (tokens.length === 0 || relaxedTsQuery.length === 0) {
    return [];
  }

  const result = await pool.query<{
    doc_id: string;
    title: string;
    source_type: DocumentSourceType;
    chunk_index: number;
    section: string | null;
    chunk_text: string;
    chunk_len: number;
    start_offset: number;
    end_offset: number;
    lexical_rank: number;
  }>(
    `
      SELECT
        c.doc_id,
        d.title,
        d.source_type,
        c.chunk_index,
        c.section,
        c.chunk_text,
        c.chunk_len,
        c.start_offset,
        c.end_offset,
        (
          ts_rank_cd(c.search_vector, to_tsquery('simple', $2)) +
          ts_rank_cd(c.search_vector, to_tsquery('simple', $1)) * 0.12 +
          CASE
            WHEN d.title ILIKE $3 THEN 0.15
            ELSE 0
          END
        ) AS lexical_rank
      FROM document_chunks c
      JOIN documents d ON d.doc_id = c.doc_id
      WHERE c.document_scope = $5
        AND c.search_vector @@ to_tsquery('simple', $2)
      ORDER BY lexical_rank DESC
      LIMIT $4
    `,
    [strictTsQuery, relaxedTsQuery, `%${query.trim()}%`, limit, scope],
  );

  return result.rows.map((row) => ({
    docId: row.doc_id,
    title: row.title,
    sourceType: row.source_type,
    chunkIndex: row.chunk_index,
    section: row.section,
    chunkText: row.chunk_text,
    chunkLen: row.chunk_len,
    startOffset: row.start_offset,
    endOffset: row.end_offset,
    lexicalRank: Number(row.lexical_rank ?? 0),
  }));
}

function tokenizeLexicalQuery(value: string) {
  return tokenizeForSearch(value);
}

function buildTsQuery(tokens: string[], mode: "strict" | "relaxed") {
  const operator = mode === "strict" ? " & " : " | ";
  return tokens.map((token) => `${token}:*`).join(operator);
}
