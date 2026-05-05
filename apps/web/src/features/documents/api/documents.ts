import { apiRequest } from "../../../shared/api/client";
import type {
  DocumentDetailResponse,
  DeleteDocumentResponse,
  DocumentsResponse,
  IngestResponse,
} from "../types/documents";

export function getDocuments(query?: string) {
  const searchParams = new URLSearchParams();

  if (query?.trim()) {
    searchParams.set("q", query.trim());
  }

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";

  return apiRequest<DocumentsResponse>(`/documents${suffix}`);
}

export async function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest<IngestResponse>("/ingest/upload", {
    method: "POST",
    body: formData,
  });
}

export function deleteDocument(docId: string) {
  return apiRequest<DeleteDocumentResponse>(`/documents/${docId}`, {
    method: "DELETE",
  });
}

export function getDocumentDetail(docId: string) {
  return apiRequest<DocumentDetailResponse>(`/documents/${docId}`);
}
