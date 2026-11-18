// Maps errors to an HTTP status and one consistent JSON shape:
//   { "error": { "code": "...", "message": "...", "details"?: ... } }
import { AppError, NotFoundError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const notFoundHandler = (req, _res, next) => {
  next(new NotFoundError(`No route for ${req.method} ${req.path}`));
};

// Express recognizes an error handler by its four arguments, so `_next` must stay.
export const errorHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.warn({ err }, err.message);
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  // Malformed JSON body (thrown by express.json()).
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
};
