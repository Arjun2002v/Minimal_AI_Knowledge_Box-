// Entry point: loads config, opens DB, wires the real dependencies, starts the HTTP server.
import { createApp } from './app.js';
import { env } from './config/env.js';
import { openDb } from './db/client.js';
import { fetchUrl } from './fetchers/url-fetcher.js';
import { logger } from './lib/logger.js';
import { createChunker } from './rag/chunker.js';
import { createEmbedder } from './rag/embeddings.js';
import { createAnswerGenerator } from './rag/llm.js';

const db = openDb(env.DB_PATH);

const app = createApp({
  db,
  fetchUrl,
  chunkText: createChunker({ chunkSize: env.CHUNK_SIZE, chunkOverlap: env.CHUNK_OVERLAP }),
  embedder: createEmbedder({ apiKey: env.GEMINI_API_KEY, model: env.EMBEDDING_MODEL, dimensions: env.EMBEDDING_DIMENSIONS }),
  generateAnswer: createAnswerGenerator({ apiKey: env.GEMINI_API_KEY, model: env.CHAT_MODEL }),
  topK: env.TOP_K,
});

const server = app.listen(env.PORT, () => {
  logger.info(
    { chatModel: env.CHAT_MODEL, embeddingModel: env.EMBEDDING_MODEL, db: env.DB_PATH },
    `API listening on http://localhost:${env.PORT}/api`,
  );
});

const shutdown = (signal) => {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
