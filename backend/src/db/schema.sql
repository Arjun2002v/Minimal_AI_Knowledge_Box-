-- items: one row per saved note or URL (full cleaned text in `content`).
CREATE TABLE IF NOT EXISTS items (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('note', 'url')),
  title      TEXT NOT NULL,
  url        TEXT,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_created_at ON items (created_at DESC);

-- chunks: pieces of an item's text plus their embedding.
-- `embedding` is a Float32 array stored as raw bytes, L2-normalized at write time
-- so cosine similarity is a plain dot product.
CREATE TABLE IF NOT EXISTS chunks (
  id        INTEGER PRIMARY KEY,
  item_id   TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  text      TEXT    NOT NULL,
  embedding BLOB    NOT NULL,
  UNIQUE (item_id, position)
);
