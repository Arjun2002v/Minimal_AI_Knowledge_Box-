import { randomUUID } from 'node:crypto';
import { inTransaction } from '../db/client.js';

const TITLE_FROM_NOTE_LENGTH = 80;

const newItem = (fields) => ({ id: randomUUID(), createdAt: new Date().toISOString(), ...fields });

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
    // Include the title so a note can be found by its title, not just its body.
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
