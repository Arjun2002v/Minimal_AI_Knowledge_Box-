import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { querySchema } from '../schemas/query.schema.js';

export const queryRoutes = (rag) => {
  const router = Router();

  router.post('/query', validateBody(querySchema), async (req, res) => {
    const result = await rag.query(req.body);
    res.json(result);
  });

  return router;
};
