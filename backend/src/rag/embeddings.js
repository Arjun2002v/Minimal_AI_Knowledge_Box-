// Embedding provider wrapper (Gemini via OpenAI-compatible API); batches inputs.
import { env } from '../config/env.js';
import { llmClient } from './client.js';

// Gemini accepts at most 100 inputs per embedding request.
const BATCH_SIZE = 100;

/**
 * Embeds texts in order; returns one vector per input.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export const embedTexts = async (texts) => {
  const vectors = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await llmClient.embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: batch,
      dimensions: env.EMBEDDING_DIMENSIONS,
    });
    const ordered = [...res.data].sort((a, b) => a.index - b.index);
    if (ordered.length !== batch.length) {
      throw new Error(`Embedding API returned ${ordered.length} vectors for ${batch.length} inputs`);
    }
    vectors.push(...ordered.map((d) => d.embedding));
  }
  return vectors;
};

export const embedText = async (text) => {
  const [vector] = await embedTexts([text]);
  return vector;
};
