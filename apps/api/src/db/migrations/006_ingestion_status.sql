ALTER TABLE documents ADD COLUMN IF NOT EXISTS ingestion_status TEXT NOT NULL DEFAULT 'indexed';
