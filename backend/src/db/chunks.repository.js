import { fromBlob, toBlob } from '../rag/vectors.js';

export const createChunksRepository = (db) => {
  const insertMany = (chunks) => {
    const stmt = db.prepare('INSERT INTO chunks (item_id, position, text, embedding) VALUES (?, ?, ?, ?)');
    for (const c of chunks) stmt.run(c.itemId, c.position, c.text, toBlob(c.embedding));
  };

  const count = () => db.prepare('SELECT COUNT(*) AS n FROM chunks').get().n;

  const allForSearch = () =>
    db
      .prepare(
        `SELECT c.id, c.item_id, c.position, c.text, c.embedding, i.title, i.url, i.type
         FROM chunks c
         JOIN items i ON i.id = c.item_id`,
      )
      .all()
      .map((r) => ({
        chunkId: r.id,
        itemId: r.item_id,
        position: r.position,
        text: r.text,
        embedding: fromBlob(r.embedding),
        title: r.title,
        url: r.url,
        type: r.type,
      }));

  return { insertMany, count, allForSearch };
};
