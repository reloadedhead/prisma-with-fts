-- AlterTable
ALTER TABLE
  "Movie"
ADD
  COLUMN "search" tsvector DEFAULT ''::tsvector;

-- Function to be invoked by trigger

CREATE OR REPLACE FUNCTION update_tsvector_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.search := to_tsvector('english', NEW.title || ' ' || COALESCE(NEW.year::TEXT, '') || ' ' || COALESCE(NEW.genre, '') || ' ' || COALESCE(NEW.extract, ''));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY definer SET search_path = public, pg_temp;

-- Trigger that keeps the TSVECTOR up to date

DROP TRIGGER IF EXISTS "update_tsvector" ON "Movie";

CREATE TRIGGER "update_tsvector"
  BEFORE INSERT OR UPDATE ON "Movie"
  FOR EACH ROW
  EXECUTE FUNCTION update_tsvector_column ();

-- CreateIndex
CREATE INDEX "Movie_search_idx" ON "Movie" USING GIN ("search");