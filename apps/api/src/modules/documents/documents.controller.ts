import type { FastifyInstance, FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";

import { createAppError } from "../../utils/app-error.js";
import { deleteDocument } from "./document-delete.service.js";
import { ingestUploadedDocument } from "./document-ingest.service.js";
import { getDocumentDetail, getDocuments } from "./document-query.service.js";
import { documentParamsSchema, documentsQuerySchema } from "./documents.schemas.js";
import { getDocumentByDocId } from "../../repositories/documents.repository.js";

export async function registerDocumentRoutes(app: FastifyInstance) {
  app.post("/ingest/upload", async (request: FastifyRequest) => {
    const file = await (request as FastifyRequest & {
      file: () => Promise<MultipartFile | undefined>;
    }).file();

    if (!file) {
      throw createAppError(400, "Файл обязателен");
    }

    const buffer = await file.toBuffer();

    return ingestUploadedDocument({
      fileName: file.filename,
      mimeType: file.mimetype,
      buffer,
      background: true,
    });
  });

  app.get("/documents", async (request: FastifyRequest) => {
    const query = documentsQuerySchema.parse(request.query);
    return getDocuments(query);
  });

  app.get("/documents/:docId", async (request: FastifyRequest) => {
    const params = documentParamsSchema.parse(request.params);
    return getDocumentDetail(params.docId);
  });

  app.get("/documents/:docId/status", async (request: FastifyRequest) => {
    const params = documentParamsSchema.parse(request.params);
    const doc = await getDocumentByDocId(params.docId);
    return { docId: doc.docId, ingestionStatus: doc.ingestionStatus, title: doc.title };
  });

  app.delete("/documents/:docId", async (request: FastifyRequest) => {
    const params = documentParamsSchema.parse(request.params);
    return deleteDocument(params.docId);
  });
}
