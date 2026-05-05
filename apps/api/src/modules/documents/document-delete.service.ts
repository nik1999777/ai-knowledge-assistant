import { deleteDocumentRecordByDocId } from "../../repositories/documents.repository.js";
import { deleteDocumentByDocId } from "../../clients/qdrant.client.js";

import type { DeleteDocumentResponse } from "./documents.types.js";

export async function deleteDocument(
  docId: string,
): Promise<DeleteDocumentResponse> {
  await deleteDocumentByDocId(docId);
  await deleteDocumentRecordByDocId(docId);

  return {
    success: true,
    docId,
  };
}
