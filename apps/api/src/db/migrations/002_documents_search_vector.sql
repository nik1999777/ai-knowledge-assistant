ALTER TABLE documents
ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION documents_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.original_file_name, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.text_content, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_search_vector_trigger ON documents;

CREATE TRIGGER documents_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, original_file_name, text_content
ON documents
FOR EACH ROW
EXECUTE FUNCTION documents_search_vector_update();

UPDATE documents
SET search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(original_file_name, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(text_content, '')), 'C')
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_documents_search_vector
ON documents
USING GIN (search_vector);
