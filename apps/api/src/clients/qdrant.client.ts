import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "../config/env.js";
import type { ParsedDocument } from "../services/document-parser.service.js";
import type { TextChunk } from "../services/chunk.service.js";
import type { DocumentScope } from "../repositories/documents.repository.js";

const QDRANT_URL = env.QDRANT_URL;
const COLLECTION_NAME = "documents";

export const qdrant = new QdrantClient({
  url: QDRANT_URL,
});

export async function initCollection() {
  const collections = await qdrant.getCollections();

  const exists = collections.collections.find(
    (collection) => collection.name === COLLECTION_NAME,
  );

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 768,
        distance: "Cosine",
      },
    });

    console.log("Qdrant collection created");
  }

  await ensurePayloadIndex("docId", "keyword");
  await ensurePayloadIndex("documentScope", "keyword");
}

export async function checkQdrantConnection() {
  await qdrant.getCollections();
}

export async function saveChunks(
  docId: string,
  documentScope: DocumentScope,
  title: string,
  sourceType: ParsedDocument["sourceType"],
  chunks: TextChunk[],
  embeddings: number[][],
) {
  const points = chunks.map((chunk, index) => ({
    id: crypto.randomUUID(),
    vector: embeddings[index],
    payload: {
      docId,
      documentScope,
      title,
      sourceType,
      text: chunk.text,
      chunkIndex: chunk.chunkIndex,
      chunkLen: chunk.chunkLen,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      section: chunk.section,
    },
  }));

  await qdrant.upsert(COLLECTION_NAME, {
    points,
  });
}

export async function searchSimilar(
  vector: number[],
  limit = 3,
  scope: DocumentScope = "user",
) {
  return qdrant.search(COLLECTION_NAME, {
    vector,
    limit,
    filter: {
      must: [
        {
          key: "documentScope",
          match: {
            value: scope,
          },
        },
      ],
    },
    with_payload: true,
  });
}

export async function deleteDocumentByDocId(docId: string) {
  await qdrant.delete(COLLECTION_NAME, {
    filter: {
      must: [
        {
          key: "docId",
          match: {
            value: docId,
          },
        },
      ],
    },
  });
}

async function ensurePayloadIndex(
  fieldName: string,
  fieldSchema: "keyword",
) {
  const collectionInfo = await qdrant.getCollection(COLLECTION_NAME);
  const payloadSchema = collectionInfo.payload_schema ?? {};

  if (fieldName in payloadSchema) {
    return;
  }

  await qdrant.createPayloadIndex(COLLECTION_NAME, {
    field_name: fieldName,
    field_schema: fieldSchema,
  });
}
