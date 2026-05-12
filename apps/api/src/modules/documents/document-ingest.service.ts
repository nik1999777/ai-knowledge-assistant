import { createDocument, deleteDocumentRecordByDocId } from "../../repositories/documents.repository.js";
import { chunkDocument } from "../../services/chunk.service.js";
import {
  parseUploadedDocuments,
  type ParsedDocument,
} from "../../services/document-parser.service.js";
import { getEmbedding } from "../../services/embeddings.service.js";
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
}): Promise<IngestResponse> {
  const { parsedDocument } = input;
  const docId = input.docId ?? crypto.randomUUID();
  const chunks = chunkDocument(parsedDocument.text);

  if (chunks.length === 0) {
    throw createAppError(400, "Не удалось подготовить документ для индексации");
  }

  const embeddings = await Promise.all(
    chunks.map((chunk) => getEmbedding(chunk.text)),
  );

  await createDocument({
    docId,
    documentScope: input.documentScope ?? "user",
    title: parsedDocument.title,
    sourceType: parsedDocument.sourceType,
    originalFileName: input.originalFileName,
    textContent: parsedDocument.text,
    characters: parsedDocument.text.length,
    chunksCount: chunks.length,
    warnings: parsedDocument.warnings,
  });

  try {
    await saveChunks(
      docId,
      input.documentScope ?? "user",
      parsedDocument.title,
      parsedDocument.sourceType,
      chunks,
      embeddings,
    );
  } catch (error) {
    await deleteDocumentRecordByDocId(docId);
    throw error;
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
