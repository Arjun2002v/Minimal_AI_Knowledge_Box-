import { setTimeout as sleep } from 'node:timers/promises';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { UpstreamError } from '../lib/errors.js';
import { toUpstreamError } from './ai-errors.js';
import { normalize } from './vectors.js';

const MAX_ATTEMPTS = 3;

export const createEmbedder = ({ apiKey, model, dimensions }) => {
  const make = (taskType) =>
    new GoogleGenerativeAIEmbeddings({ apiKey, model, taskType, outputDimensionality: dimensions, maxRetries: 2 });

  const forDocuments = make('RETRIEVAL_DOCUMENT');
  const forQueries = make('RETRIEVAL_QUERY');

  const isComplete = (vectors, expectedCount) =>
    vectors.length === expectedCount && vectors.every((v) => v.length === dimensions);

  // LangChain returns empty vectors instead of throwing when a batch fails, so check and retry.
  const embedDocuments = async (texts) => {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let vectors;
      try {
        vectors = await forDocuments.embedDocuments(texts);
      } catch (err) {
        throw toUpstreamError(err, 'Embedding the content');
      }
      if (isComplete(vectors, texts.length)) return vectors.map(normalize);
      if (attempt < MAX_ATTEMPTS) await sleep(1000 * attempt);
    }
    throw new UpstreamError(
      'Embedding the content failed: the AI provider returned no embeddings (often a temporary rate limit), try again in a minute',
    );
  };

  const embedQuery = async (text) => {
    let vector;
    try {
      vector = await forQueries.embedQuery(text);
    } catch (err) {
      throw toUpstreamError(err, 'Embedding the question');
    }
    if (!isComplete([vector], 1)) {
      throw new UpstreamError('Embedding the question failed: the AI provider returned an empty embedding, try again shortly');
    }
    return normalize(vector);
  };

  return { embedDocuments, embedQuery };
};
