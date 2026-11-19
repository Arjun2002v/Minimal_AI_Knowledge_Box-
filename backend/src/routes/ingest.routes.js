import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { ingestSchema } from '../schemas/ingest.schema.js';

export const ingestRoutes = (ingestion) => {
  const router = Router();

  router.post('/ingest', validateBody(ingestSchema), async (req, res) => {
    const item = await ingestion.ingest(req.body);
    res.status(201).json({ item });
  });

  return router;
};
