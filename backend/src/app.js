// Builds the Express app: middleware, routes, error handler.
// No listen() here, so tests can create an app with an in-memory DB and fake fetcher.
import express from 'express';
import { createItemsRepository } from './db/items.repository.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { apiRoutes } from './routes/index.js';
import { createIngestionService } from './services/ingestion.service.js';
import { createItemsService } from './services/items.service.js';

export const createApp = ({ db, fetchUrl }) => {
  const itemsRepo = createItemsRepository(db);
  const services = {
    ingestion: createIngestionService(itemsRepo, fetchUrl),
    items: createItemsService(itemsRepo),
  };

  const app = express();

  app.use(express.json({ limit: '256kb' }));

  app.use('/api', apiRoutes(services));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
