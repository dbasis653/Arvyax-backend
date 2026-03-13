import { Router } from "express";
import { body, validationResult } from "express-validator";
import { ValidationError } from "../utils/api-error.js";
import { createUserController, loginUserController } from "../controllers/user.controller.js";

const router = Router();

// Checks express-validator results and throws a ValidationError if any fail.
const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }
  next();
};

const usernameRules = [
  body("username")
    .notEmpty()
    .withMessage("username is required")
    .isLength({ min: 2, max: 30 })
    .withMessage("username must be 2–30 characters"),
];

// POST /api/users
router.post("/", usernameRules, validate, createUserController);

// POST /api/users/login
router.post("/login", usernameRules, validate, loginUserController);

export default router;
