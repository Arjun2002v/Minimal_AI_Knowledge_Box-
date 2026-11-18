// Test doubles: build the real app with an in-memory DB and fake network / AI pieces.
import { createApp } from '../src/app.js';
import { openDb } from '../src/db/client.js';
import { UnprocessableError } from '../src/lib/errors.js';
import { createChunker } from '../src/rag/chunker.js';
import { normalize } from '../src/rag/vectors.js';

const DIMS = 64;

/** Deterministic bag-of-words "embedding": texts sharing words get similar vectors. */
export const fakeEmbed = (text) => {
  const v = new Array(DIMS).fill(0);
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    let h = 0;
    for (const ch of word) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    v[h % DIMS] += 1;
  }
  return normalize(v);
};

export const fakeFetch = async (url) => {
  if (url.includes('broken')) throw new UnprocessableError('Could not fetch the page (HTTP 404)');
  return { url, title: 'Example article', text: 'Readable text from the page.' };
};

/**
 * @param {{ generateAnswer?: Function, embedder?: object }} overrides
 * @returns {{ app: import('express').Express, calls: { answer: Array<{ question: string, context: string }> } }}
 */
export const createTestApp = (overrides = {}) => {
  const calls = { answer: [] };
  const app = createApp({
    db: openDb(':memory:'),
    fetchUrl: fakeFetch,
    chunkText: createChunker({ chunkSize: 200, chunkOverlap: 40 }),
    embedder: {
      embedDocuments: async (texts) => texts.map(fakeEmbed),
      embedQuery: async (text) => fakeEmbed(text),
    },
    generateAnswer: async (input) => {
      calls.answer.push(input);
      return 'Run VACUUM to reclaim space [1].';
    },
    topK: 3,
    ...overrides,
  });
  return { app, calls };
};
