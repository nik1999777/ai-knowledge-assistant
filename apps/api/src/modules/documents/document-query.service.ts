import { getDocumentByDocId, listDocuments } from "../../repositories/documents.repository.js";
import { chunkDocument } from "../../services/chunk.service.js";

import type { DocumentsQueryInput } from "./documents.schemas.js";
import type { DocumentDetailResponse, DocumentsResponse } from "./documents.types.js";

export async function getDocuments(
  input: DocumentsQueryInput = {},
): Promise<DocumentsResponse> {
  const documents = await listDocuments({
    query: input.q,
  });

  return {
    documents,
  };
}

export async function getDocumentDetail(
  docId: string,
): Promise<DocumentDetailResponse> {
  const document = await getDocumentByDocId(docId);

  return {
    ...document,
    chunks: chunkDocument(document.textContent).map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      section: chunk.section,
      chunkLen: chunk.chunkLen,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
    })),
  };
}
