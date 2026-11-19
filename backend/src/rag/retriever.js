import { dot } from './vectors.js';

export const createRetriever = (chunksRepo) => (queryVector, topK) =>
  chunksRepo
    .allForSearch()
    .map(({ embedding, ...chunk }) => ({ ...chunk, score: dot(queryVector, embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
