// Orchestrates query: embed question -> retrieve top-k chunks -> build prompt -> call LLM -> map citations.
import { logger } from '../lib/logger.js';
import { citedBlockNumbers, formatContext } from '../rag/prompt.js';

export const EMPTY_BOX_ANSWER = 'Your knowledge box is empty. Save a note or a link first, then ask about it.';

/**
 * @param {{
 *   chunksRepo: ReturnType<typeof import('../db/chunks.repository.js').createChunksRepository>,
 *   retrieve: (queryVector: Float32Array, topK: number) => Array<object>,
 *   embedder: { embedQuery: (text: string) => Promise<Float32Array> },
 *   generateAnswer: (input: { question: string, context: string }) => Promise<string>,
 *   defaultTopK: number,
 * }} deps
 */
export const createRagService = ({ chunksRepo, retrieve, embedder, generateAnswer, defaultTopK }) => {
  const query = async ({ question, topK = defaultTopK }) => {
    if (chunksRepo.count() === 0) return { answer: EMPTY_BOX_ANSWER, sources: [] };

    const queryVector = await embedder.embedQuery(question);
    const hits = retrieve(queryVector, topK);
    const answer = await generateAnswer({ question, context: formatContext(hits) });

    const sources = citedBlockNumbers(answer, hits.length).map((n) => {
      const hit = hits[n - 1];
      return {
        n,
        itemId: hit.itemId,
        title: hit.title,
        url: hit.url,
        type: hit.type,
        snippet: hit.text,
        score: Number(hit.score.toFixed(3)),
      };
    });

    logger.info(
      { topK, retrieved: hits.map((h) => ({ itemId: h.itemId, position: h.position, score: Number(h.score.toFixed(3)) })), cited: sources.map((s) => s.n) },
      'rag query',
    );

    return { answer, sources };
  };

  return { query };
};
