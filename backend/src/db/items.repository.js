// SQL access for items.

const PREVIEW_LENGTH = 200;

export const createItemsRepository = (db) => {
  const insert = (item) => {
    db.prepare(
      `INSERT INTO items (id, type, title, url, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(item.id, item.type, item.title, item.url, item.content, item.createdAt);
  };

  /** Newest first. Only the first few hundred characters of content are returned. */
  const list = (limit = 100) => {
    const rows = db
      .prepare(
        `SELECT id, type, title, url, substr(content, 1, ?) AS preview, created_at
         FROM items
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`,
      )
      .all(PREVIEW_LENGTH, limit);

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      url: r.url,
      preview: r.preview,
      createdAt: r.created_at,
    }));
  };

  return { insert, list };
};
