// Wraps an async Express controller so thrown errors are forwarded to next() automatically.
// Eliminates the need for try/catch in every controller — errors reach the central error handler.
const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

export { asyncHandler };
