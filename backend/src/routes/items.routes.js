// GET /items - lists saved items (metadata + preview), newest first.
import { Router } from 'express';

export const itemsRoutes = (items) => {
  const router = Router();

  router.get('/items', (_req, res) => {
    res.json({ items: items.list() });
  });

  return router;
};
