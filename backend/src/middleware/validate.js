// Generic body-validation middleware -> 400 with field-level errors.
import { ValidationError } from '../lib/errors.js';

/** @param {import('zod').ZodType} schema */
export const validateBody = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(body)',
      message: issue.message,
    }));
    return next(new ValidationError('Invalid request body', fields));
  }
  req.body = result.data; // trimmed / normalized values
  next();
};
