import { validationResult } from "express-validator";
import { ValidationError } from "../utils/api-error.js";

// Checks express-validator results and throws a ValidationError if any rules failed.
// Drop this after any array of express-validator rules — controllers never see invalid input.
const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }
  next();
};

export { validate };
