import {
  createDocument,
  deleteDocumentRecordByDocId,
  saveDocumentChunks,
  deleteDocumentChunks,
  updateIngestionStatus,
} from "../../repositories/documents.repository.js";
import { chunkDocument } from "../../services/chunk.service.js";
import {
  parseUploadedDocuments,
  type ParsedDocument,
} from "../../services/document-parser.service.js";
import { getDocumentEmbedding } from "../../services/embeddings.service.js";
import { saveChunks } from "../../clients/qdrant.client.js";
import { createAppError } from "../../utils/app-error.js";

import type { IngestResponse } from "./documents.types.js";
import type { DocumentScope } from "../../repositories/documents.repository.js";

export async function ingestUploadedDocument(input: {
  docId?: string;
  documentScope?: DocumentScope;
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
  background?: boolean;
}): Promise<IngestResponse> {
  const parsedDocuments = await parseUploadedDocuments(input);
  const results = [];

  if (input.docId && parsedDocuments.length > 1) {
    throw createAppError(400, "docId можно передать только для одиночного документа");
  }

  for (const parsedDocument of parsedDocuments) {
    results.push(
      await ingestParsedDocument({
        docId: parsedDocuments.length === 1 ? input.docId : undefined,
        documentScope: input.documentScope,
        originalFileName: parsedDocument.originalFileName ?? input.fileName,
        parsedDocument,
        background: input.background,
      }),
    );
  }

  if (results.length === 1) {
    return results[0];
  }

  const warnings = Array.from(
    new Set(results.flatMap((result) => result.warnings ?? [])),
  );

  return {
    docId: results[0].docId,
    title: input.fileName,
    chunks: results.reduce((total, result) => total + result.chunks, 0),
    characters: results.reduce((total, result) => total + result.characters, 0),
    sourceType: "zip",
    warnings,
    documents: results,
    totalDocuments: results.length,
  };
}

async function ingestParsedDocument(input: {
  docId?: string;
  documentScope?: DocumentScope;
  originalFileName: string;
  parsedDocument: ParsedDocument;
  background?: boolean;
}): Promise<IngestResponse> {
  const { parsedDocument } = input;
  const docId = input.docId ?? crypto.randomUUID();
  const chunks = chunkDocument(parsedDocument.text);
  const scope = input.documentScope ?? "user";

  if (chunks.length === 0) {
    throw createAppError(400, "Не удалось подготовить документ для индексации");
  }

  await createDocument({
    docId,
    documentScope: scope,
    ingestionStatus: input.background ? "processing" : "indexed",
    title: parsedDocument.title,
    sourceType: parsedDocument.sourceType,
    originalFileName: input.originalFileName,
    textContent: parsedDocument.text,
    rawTextContent: parsedDocument.rawText,
    characters: parsedDocument.text.length,
    chunksCount: chunks.length,
    warnings: parsedDocument.warnings,
  });

  try {
    await saveDocumentChunks(
      chunks.map((chunk) => ({
        docId,
        documentScope: scope,
        chunkIndex: chunk.chunkIndex,
        section: chunk.section,
        chunkText: chunk.text,
        chunkLen: chunk.chunkLen,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
      })),
    );
  } catch (error) {
    await deleteDocumentRecordByDocId(docId);
    throw error;
  }

  if (input.background) {
    void embedAndIndex(docId, scope, parsedDocument.title, parsedDocument.sourceType, chunks)
      .then(() => updateIngestionStatus(docId, "indexed"))
      .catch(async (err) => {
        console.error(`[ingest] background embedding failed docId=${docId}`, err);
        await updateIngestionStatus(docId, "failed").catch(() => undefined);
      });
  } else {
    const embeddings = await Promise.all(
      chunks.map((chunk) => getDocumentEmbedding(chunk.text)),
    );

    try {
      await saveChunks(
        docId,
        scope,
        parsedDocument.title,
        parsedDocument.sourceType,
        chunks,
        embeddings,
      );
    } catch (error) {
      await deleteDocumentChunks(docId);
      await deleteDocumentRecordByDocId(docId);
      throw error;
    }
  }

  return {
    docId,
    title: parsedDocument.title,
    chunks: chunks.length,
    characters: parsedDocument.text.length,
    sourceType: parsedDocument.sourceType,
    warnings: parsedDocument.warnings,
  };
}

async function embedAndIndex(
  docId: string,
  scope: DocumentScope,
  title: string,
  sourceType: ParsedDocument["sourceType"],
  chunks: ReturnType<typeof chunkDocument>,
) {
  const embeddings = await Promise.all(
    chunks.map((chunk) => getDocumentEmbedding(chunk.text)),
  );

  await saveChunks(docId, scope, title, sourceType, chunks, embeddings);
}
