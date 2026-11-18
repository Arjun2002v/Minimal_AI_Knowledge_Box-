// One structured log line per request (request id, method, path, status, duration).
import { randomUUID } from 'node:crypto';
import { logger } from '../lib/logger.js';

export const requestLogger = (req, res, next) => {
  const requestId = req.get('x-request-id') ?? randomUUID();
  const start = process.hrtime.bigint();
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info(
      { requestId, method: req.method, path: req.originalUrl, status: res.statusCode, durationMs: Math.round(durationMs) },
      'request',
    );
  });

  next();
};
