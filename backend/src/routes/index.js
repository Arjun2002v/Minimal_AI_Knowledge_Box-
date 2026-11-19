import { Router } from 'express';
import { ingestRoutes } from './ingest.routes.js';
import { itemsRoutes } from './items.routes.js';
import { queryRoutes } from './query.routes.js';

export const apiRoutes = (services) => {
  const router = Router();
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  router.use(ingestRoutes(services.ingestion));
  router.use(itemsRoutes(services.items));
  router.use(queryRoutes(services.rag));
  return router;
};
