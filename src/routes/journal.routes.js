import { Router } from "express";
import { body, param, validationResult } from "express-validator";
import { ValidationError } from "../utils/api-error.js";
import {
  createJournalEntry,
  getJournalEntries,
  analyzeText,
  getJournalInsights,
} from "../controllers/journal.controller.js";

const router = Router();

// Middleware that checks express-validator results and throws a ValidationError if any fail.
// Applied after every validate() call so controllers never see invalid input.
const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }
  next();
};

// POST /api/journal
router.post(
  "/",
  [
    body("username").notEmpty().withMessage("username is required"),
    body("ambience")
      .isIn(["forest", "ocean", "mountain"])
      .withMessage("ambience must be forest, ocean, or mountain"),
    body("text")
      .notEmpty()
      .withMessage("text is required")
      .isLength({ max: 5000 })
      .withMessage("text must be 5000 characters or fewer"),
  ],
  validate,
  createJournalEntry,
);

// GET /api/journal/insights/:userId — must be registered before /:username to avoid route conflict
router.get(
  "/insights/:userId",
  [param("userId").notEmpty().withMessage("userId param is required")],
  validate,
  getJournalInsights,
);

// POST /api/journal/analyze — must be registered before /:username to avoid route conflict
router.post(
  "/analyze",
  [
    body("text")
      .notEmpty()
      .withMessage("text is required")
      .isLength({ max: 5000 })
      .withMessage("text must be 5000 characters or fewer"),
  ],
  validate,
  analyzeText,
);

// GET /api/journal/:username
router.get(
  "/:username",
  [param("username").notEmpty().withMessage("username param is required")],
  validate,
  getJournalEntries,
);

export default router;
