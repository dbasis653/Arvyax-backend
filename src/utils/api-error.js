// Base error class for all API errors.
// Extends native Error so it can be thrown and caught normally.
// statusCode, errors[], and success=false give controllers a consistent shape to return.
class ApiError extends Error {
  constructor(
    statusCode,
    message = "Something went wrong",
    errors = [],
    stack = "",
  ) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    this.data = null;
    this.success = false;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Thrown when request body, params, or query fail validation.
// Maps to HTTP 400.
class ValidationError extends ApiError {
  constructor(message = "Validation failed", errors = []) {
    super(400, message, errors);
  }
}

// Thrown when a DB lookup returns null for an expected resource.
// Maps to HTTP 404.
class NotFoundError extends ApiError {
  constructor(message = "Resource not found") {
    super(404, message);
  }
}

// Thrown when an external service (LLM, email, etc.) fails.
// Maps to HTTP 502.
class ExternalServiceError extends ApiError {
  constructor(message = "External service error") {
    super(502, message);
  }
}

// Thrown when a unique constraint is violated (e.g. duplicate username).
// Maps to HTTP 409.
class ConflictError extends ApiError {
  constructor(message = "Resource already exists") {
    super(409, message);
  }
}

export { ApiError, ValidationError, NotFoundError, ExternalServiceError, ConflictError };
