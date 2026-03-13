import { Router } from "express";
import { body, validationResult } from "express-validator";
import { ValidationError } from "../utils/api-error.js";
import { createUserController } from "../controllers/user.controller.js";

const router = Router();

// Checks express-validator results and throws a ValidationError if any fail.
const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }
  next();
};

// POST /api/users
router.post(
  "/",
  [
    body("username")
      .notEmpty()
      .withMessage("username is required")
      .isLength({ min: 2, max: 30 })
      .withMessage("username must be 2–30 characters"),
  ],
  validate,
  createUserController,
);

export default router;
