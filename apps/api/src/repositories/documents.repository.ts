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
        characters,
        chunks_count,
        warnings
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
    `,
    [
      input.docId,
      input.documentScope ?? "user",
      input.title,
      input.sourceType,
      input.originalFileName,
      input.textContent,
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
      WITH strict_matches AS (
        SELECT
          d.doc_id,
          d.document_scope,
          d.title,
          d.source_type,
          d.text_content,
          d.updated_at,
          (
            ts_rank_cd(d.search_vector, to_tsquery('simple', $1)) * 1.12 +
            CASE
              WHEN d.title ILIKE $3 THEN 0.15
              WHEN d.original_file_name ILIKE $3 THEN 0.08
              ELSE 0
            END
          ) AS lexical_rank
        FROM documents d
        WHERE d.document_scope = $5
          AND d.search_vector @@ to_tsquery('simple', $1)
      ),
      relaxed_matches AS (
        SELECT
          d.doc_id,
          d.document_scope,
          d.title,
          d.source_type,
          d.text_content,
          d.updated_at,
          (
            ts_rank_cd(d.search_vector, to_tsquery('simple', $2)) +
            CASE
              WHEN d.title ILIKE $3 THEN 0.15
              WHEN d.original_file_name ILIKE $3 THEN 0.08
              ELSE 0
            END
          ) AS lexical_rank
        FROM documents d
        WHERE d.document_scope = $5
          AND d.search_vector @@ to_tsquery('simple', $2)
          AND NOT (d.search_vector @@ to_tsquery('simple', $1))
      )
      SELECT doc_id, document_scope, title, source_type, text_content, lexical_rank
      FROM (
        SELECT * FROM strict_matches
        UNION ALL
        SELECT * FROM relaxed_matches
      ) ranked
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

function tokenizeLexicalQuery(value: string) {
  return tokenizeForSearch(value);
}

function buildTsQuery(tokens: string[], mode: "strict" | "relaxed") {
  const operator = mode === "strict" ? " & " : " | ";
  return tokens.map((token) => `${token}:*`).join(operator);
}
