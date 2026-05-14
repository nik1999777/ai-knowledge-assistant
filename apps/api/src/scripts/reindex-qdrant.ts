import { initCollection, deleteDocumentByDocId, saveChunks } from "../clients/qdrant.client.js";
import { initPostgres, getPostgresPool } from "../db/postgres.client.js";
import { getDocumentEmbedding } from "../services/embeddings.service.js";
import { chunkDocument } from "../services/chunk.service.js";
import { saveDocumentChunks, deleteDocumentChunks } from "../repositories/documents.repository.js";
import type { DocumentScope, DocumentSourceType } from "../repositories/documents.repository.js";

type DocRow = {
  doc_id: string;
  document_scope: DocumentScope;
  title: string;
  source_type: DocumentSourceType;
  text_content: string;
};

type ChunkRow = {
  chunk_index: number;
  section: string | null;
  chunk_text: string;
  chunk_len: number;
  start_offset: number;
  end_offset: number;
};

async function main() {
  const scope = (process.argv[2] ?? "user") as DocumentScope;
  const db = getPostgresPool();

  await initPostgres();
  await initCollection();

  const { rows: docs } = await db.query<DocRow>(
    `SELECT doc_id, document_scope, title, source_type, text_content
     FROM documents WHERE document_scope = $1 ORDER BY created_at`,
    [scope],
  );

  console.log(`[reindex] scope=${scope} docs=${docs.length}`);

  for (const doc of docs) {
    const { rows: storedChunks } = await db.query<ChunkRow>(
      `SELECT chunk_index, section, chunk_text, chunk_len, start_offset, end_offset
       FROM document_chunks WHERE doc_id = $1 ORDER BY chunk_index`,
      [doc.doc_id],
    );

    let chunks: ChunkRow[];

    if (storedChunks.length > 0) {
      chunks = storedChunks;
    } else {
      // Document was indexed before document_chunks table existed — re-chunk from text_content
      const textChunks = chunkDocument(doc.text_content);

      if (textChunks.length === 0) {
        console.log(`[reindex] skip docId=${doc.doc_id} title="${doc.title}" — empty text`);
        continue;
      }

      await deleteDocumentChunks(doc.doc_id);
      await saveDocumentChunks(
        textChunks.map((c) => ({
          docId: doc.doc_id,
          documentScope: doc.document_scope,
          chunkIndex: c.chunkIndex,
          section: c.section,
          chunkText: c.text,
          chunkLen: c.chunkLen,
          startOffset: c.startOffset,
          endOffset: c.endOffset,
        })),
      );

      chunks = textChunks.map((c) => ({
        chunk_index: c.chunkIndex,
        section: c.section,
        chunk_text: c.text,
        chunk_len: c.chunkLen,
        start_offset: c.startOffset,
        end_offset: c.endOffset,
      }));
    }

    const embeddings = await Promise.all(
      chunks.map((c: ChunkRow) => getDocumentEmbedding(c.chunk_text)),
    );

    await deleteDocumentByDocId(doc.doc_id);

    await saveChunks(
      doc.doc_id,
      doc.document_scope,
      doc.title,
      doc.source_type,
      chunks.map((c: ChunkRow) => ({
        chunkIndex: c.chunk_index,
        section: c.section,
        text: c.chunk_text,
        chunkLen: c.chunk_len,
        startOffset: c.start_offset,
        endOffset: c.end_offset,
      })),
      embeddings,
    );

    console.log(`[reindex] done docId=${doc.doc_id} title="${doc.title}" chunks=${chunks.length}`);
  }

  console.log(`[reindex] complete`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
