import { createDocument, deleteDocumentRecordByDocId } from "../../repositories/documents.repository.js";
import { chunkDocument } from "../../services/chunk.service.js";
import { parseDocument } from "../../services/document-parser.service.js";
import { getEmbedding } from "../../services/embeddings.service.js";
import { saveChunks } from "../../clients/qdrant.client.js";
import { createAppError } from "../../utils/app-error.js";

import type { IngestResponse } from "./documents.types.js";

export async function ingestUploadedDocument(input: {
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
}): Promise<IngestResponse> {
  const parsedDocument = await parseDocument(input);
  const docId = crypto.randomUUID();
  const chunks = chunkDocument(parsedDocument.text);

  if (chunks.length === 0) {
    throw createAppError(400, "Не удалось подготовить документ для индексации");
  }

  const embeddings = await Promise.all(
    chunks.map((chunk) => getEmbedding(chunk.text)),
  );

  await createDocument({
    docId,
    title: parsedDocument.title,
    sourceType: parsedDocument.sourceType,
    originalFileName: input.fileName,
    textContent: parsedDocument.text,
    characters: parsedDocument.text.length,
    chunksCount: chunks.length,
    warnings: parsedDocument.warnings,
  });

  try {
    await saveChunks(
      docId,
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
