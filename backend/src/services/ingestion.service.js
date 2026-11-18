// Orchestrates ingest: fetch (if URL) -> store item.
// Next step (RAG): chunk -> embed -> store chunks.
import { randomUUID } from 'node:crypto';

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

const toSummary = (item) => ({
  id: item.id,
  type: item.type,
  title: item.title,
  url: item.url,
  preview: item.content.slice(0, 200),
  createdAt: item.createdAt,
});

/**
 * @param {ReturnType<typeof import('../db/items.repository.js').createItemsRepository>} itemsRepo
 * @param {(url: string) => Promise<{ url: string, title: string, text: string }>} fetchUrl
 */
export const createIngestionService = (itemsRepo, fetchUrl) => {
  const fromUrl = async (url) => {
    const page = await fetchUrl(url);
    return newItem({ type: 'url', title: page.title, url: page.url, content: page.text });
  };

  const fromNote = (content, title) =>
    newItem({ type: 'note', title: title || titleFromText(content), url: null, content });

  const ingest = async (input) => {
    const item = input.type === 'url' ? await fromUrl(input.url) : fromNote(input.content, input.title);
    itemsRepo.insert(item);
    return toSummary(item);
  };

  return { ingest };
};
