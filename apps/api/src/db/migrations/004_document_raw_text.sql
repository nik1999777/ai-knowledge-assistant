ALTER TABLE documents
ADD COLUMN IF NOT EXISTS raw_text_content TEXT;

UPDATE documents
SET raw_text_content = text_content
WHERE raw_text_content IS NULL;

ALTER TABLE documents
ALTER COLUMN raw_text_content SET NOT NULL;
