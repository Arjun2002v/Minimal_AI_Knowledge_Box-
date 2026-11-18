// Builds the Express app: middleware, routes, error handler.
// No listen() here, and every outside dependency (DB, URL fetcher, AI) is passed in,
// so tests can build an app with an in-memory DB and fakes.
import express from 'express';
import { createChunksRepository } from './db/chunks.repository.js';
import { createItemsRepository } from './db/items.repository.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { createRetriever } from './rag/retriever.js';
import { apiRoutes } from './routes/index.js';
import { createIngestionService } from './services/ingestion.service.js';
import { createItemsService } from './services/items.service.js';
import { createRagService } from './services/rag.service.js';


export const createApp = ({ db, fetchUrl, chunkText, embedder, generateAnswer, topK }) => {
  const itemsRepo = createItemsRepository(db);
  const chunksRepo = createChunksRepository(db);

  const services = {
    ingestion: createIngestionService({ db, itemsRepo, chunksRepo, fetchUrl, chunkText, embedder }),
    items: createItemsService(itemsRepo),
    rag: createRagService({ chunksRepo, retrieve: createRetriever(chunksRepo), embedder, generateAnswer, defaultTopK: topK }),
  };

  const app = express();
  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(express.json({ limit: '256kb' }));

  app.use('/api', apiRoutes(services));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
