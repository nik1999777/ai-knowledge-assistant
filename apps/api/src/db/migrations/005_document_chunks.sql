CREATE TABLE IF NOT EXISTS document_chunks (
  id BIGSERIAL PRIMARY KEY,
  doc_id TEXT NOT NULL,
  document_scope TEXT NOT NULL DEFAULT 'user',
  chunk_index INTEGER NOT NULL,
  section TEXT,
  chunk_text TEXT NOT NULL,
  chunk_len INTEGER NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  search_vector tsvector,
  UNIQUE(doc_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_id
ON document_chunks(doc_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_search_vector
ON document_chunks USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_document_chunks_scope
ON document_chunks(document_scope);
