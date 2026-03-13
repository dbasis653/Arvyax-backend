import { ApiError } from "../utils/api-error.js";

// Central error handler — must be registered LAST in app.js (after all routes).
// Catches anything passed to next(err) or thrown inside asyncHandler-wrapped controllers.
// Returns a consistent JSON error shape; never leaks stack traces in production.
const errorHandler = (err, req, res, next) => {
  // 1. If the error is already a structured ApiError, use its values directly
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  // 2. Unknown / unexpected errors — log internally, return generic 500
  console.error(err);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
    errors: [],
  });
};

export { errorHandler };
