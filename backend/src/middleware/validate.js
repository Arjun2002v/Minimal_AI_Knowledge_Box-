import { ValidationError } from '../lib/errors.js';

export const validateBody = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(body)',
      message: issue.message,
    }));
    return next(new ValidationError('Invalid request body', fields));
  }
  req.body = result.data;
  next();
};
