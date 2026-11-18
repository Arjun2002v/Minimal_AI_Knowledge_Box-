// Cosine-similarity top-k search over stored chunk embeddings.
// Brute force: every chunk is scored on every query. Fine for a personal inbox
// (tens of thousands of chunks); see docs/ARCHITECTURE.md for what to do beyond that.
import { dot } from './vectors.js';

/**
 * @param {ReturnType<typeof import('../db/chunks.repository.js').createChunksRepository>} chunksRepo
 */
export const createRetriever = (chunksRepo) => (queryVector, topK) =>
  chunksRepo
    .allForSearch()
    .map(({ embedding, ...chunk }) => ({ ...chunk, score: dot(queryVector, embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
