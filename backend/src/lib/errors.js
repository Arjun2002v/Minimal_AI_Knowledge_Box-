export class AppError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class UnprocessableError extends AppError {
  constructor(message) {
    super(message, 422, 'UNPROCESSABLE');
  }
}

export class UpstreamError extends AppError {
  constructor(message) {
    super(message, 502, 'UPSTREAM_ERROR');
  }
}
