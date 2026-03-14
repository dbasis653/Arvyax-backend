import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { body, param } from "express-validator";
import { validate } from "../middlewares/validate.js";
import {
  createJournalEntry,
  getJournalEntries,
  analyzeText,
  getJournalInsights,
  analyzeEntryById,
} from "../controllers/journal.controller.js";
import {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
  RATE_LIMIT_HEADERS,
  AMBIENCE_OPTIONS,
  MAX_TEXT_LENGTH,
} from "../constants/server.constants.js";

const router = Router();

// Limits LLM-backed endpoints to 10 requests per 15 minutes per IP.
// Protects against Groq API quota exhaustion and cost abuse.
const llmRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX,
  standardHeaders: RATE_LIMIT_HEADERS,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

// POST /api/journal
router.post(
  "/",
  llmRateLimiter,
  [
    body("username").notEmpty().withMessage("username is required"),
    body("ambience")
      .isIn(AMBIENCE_OPTIONS)
      .withMessage(`ambience must be ${AMBIENCE_OPTIONS.join(", ")}`),
    body("text")
      .notEmpty()
      .withMessage("text is required")
      .isLength({ max: MAX_TEXT_LENGTH })
      .withMessage(`text must be ${MAX_TEXT_LENGTH} characters or fewer`),
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
  llmRateLimiter,
  [
    body("text")
      .notEmpty()
      .withMessage("text is required")
      .isLength({ max: MAX_TEXT_LENGTH })
      .withMessage(`text must be ${MAX_TEXT_LENGTH} characters or fewer`),
  ],
  validate,
  analyzeText,
);

// POST /api/journal/:id/analyze — must be registered before /:username to avoid route conflict
router.post(
  "/:id/analyze",
  llmRateLimiter,
  [param("id").notEmpty().withMessage("id param is required")],
  validate,
  analyzeEntryById,
);

// GET /api/journal/:username
router.get(
  "/:username",
  [param("username").notEmpty().withMessage("username param is required")],
  validate,
  getJournalEntries,
);

export default router;
