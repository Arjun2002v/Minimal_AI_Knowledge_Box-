// Orchestrates ingest: fetch (if URL) -> chunk -> embed -> store item + chunks.
// Embedding happens before anything is written, so a failed AI call leaves no half-saved item.
import { randomUUID } from 'node:crypto';
import { inTransaction } from '../db/client.js';

const TITLE_FROM_NOTE_LENGTH = 80;

const newItem = (fields) => ({ id: randomUUID(), createdAt: new Date().toISOString(), ...fields });

/** First line of the note, cut at a word boundary. */
const titleFromText = (text) => {
  const firstLine = text.split('\n', 1)[0].trim();
  if (firstLine.length <= TITLE_FROM_NOTE_LENGTH) return firstLine;
  const cut = firstLine.slice(0, TITLE_FROM_NOTE_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > 40 ? cut.slice(0, lastSpace) : cut}…`;
};

const toSummary = (item, chunkCount) => ({
  id: item.id,
  type: item.type,
  title: item.title,
  url: item.url,
  preview: item.content.slice(0, 200),
  createdAt: item.createdAt,
  chunkCount,
});

/**
 * @param {{
 *   db: import('node:sqlite').DatabaseSync,
 *   itemsRepo: ReturnType<typeof import('../db/items.repository.js').createItemsRepository>,
 *   chunksRepo: ReturnType<typeof import('../db/chunks.repository.js').createChunksRepository>,
 *   fetchUrl: (url: string) => Promise<{ url: string, title: string, text: string }>,
 *   chunkText: (text: string) => Promise<string[]>,
 *   embedder: { embedDocuments: (texts: string[]) => Promise<Float32Array[]> },
 * }} deps
 */
export const createIngestionService = ({ db, itemsRepo, chunksRepo, fetchUrl, chunkText, embedder }) => {
  const fromUrl = async (url) => {
    const page = await fetchUrl(url);
    return newItem({ type: 'url', title: page.title, url: page.url, content: page.text });
  };

  const fromNote = (content, title) =>
    newItem({ type: 'note', title: title || titleFromText(content), url: null, content });

  const ingest = async (input) => {
    const item = input.type === 'url' ? await fromUrl(input.url) : fromNote(input.content, input.title);

    const texts = await chunkText(item.content);
    // Embed the title with each chunk so questions that match the title ("my reminder")
    // find the item even when the body alone doesn't. The stored chunk text stays as-is.
    const embeddings = await embedder.embedDocuments(texts.map((text) => `${item.title}\n\n${text}`));
    if (embeddings.length !== texts.length) {
      throw new Error(`Embedder returned ${embeddings.length} vectors for ${texts.length} chunks`);
    }
    const chunks = texts.map((text, position) => ({ itemId: item.id, position, text, embedding: embeddings[position] }));

    inTransaction(db, () => {
      itemsRepo.insert(item);
      chunksRepo.insertMany(chunks);
    });

    return toSummary(item, chunks.length);
  };

  return { ingest };
};
