-- items: one row per saved note or URL.
-- (A chunks table for RAG will be added in the next step.)
CREATE TABLE IF NOT EXISTS items (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('note', 'url')),
  title      TEXT NOT NULL,
  url        TEXT,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_created_at ON items (created_at DESC);
