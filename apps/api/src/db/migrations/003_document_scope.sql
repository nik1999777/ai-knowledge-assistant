ALTER TABLE documents
ADD COLUMN IF NOT EXISTS document_scope TEXT NOT NULL DEFAULT 'user';

UPDATE documents
SET document_scope = 'eval'
WHERE doc_id LIKE '00000000-0000-4000-8000-%';

CREATE INDEX IF NOT EXISTS idx_documents_document_scope
ON documents (document_scope);

