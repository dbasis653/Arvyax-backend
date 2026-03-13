import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { createEntry, getEntriesByUser, getInsightsByUserId } from "../services/journal.service.js";
import { analyzeJournalText } from "../services/llm.service.js";

// POST /api/journal
// Reads { username, ambience, text } from body, delegates to service, returns 201.
const createJournalEntry = asyncHandler(async (req, res) => {
  const { username, ambience, text } = req.body;

  const entry = await createEntry({ username, ambience, text });

  return res
    .status(201)
    .json(new ApiResponse(201, entry, "Journal entry created"));
});

// GET /api/journal/:username
// Reads username from params, delegates to service, returns 200 with entries array.
const getJournalEntries = asyncHandler(async (req, res) => {
  const { username } = req.params;

  const entries = await getEntriesByUser(username);

  return res
    .status(200)
    .json(new ApiResponse(200, entries, "Journal entries fetched"));
});

// POST /api/journal/analyze
// Reads { text } from body, runs LLM analysis (cache-backed), returns { emotion, keywords, summary }.
const analyzeText = asyncHandler(async (req, res) => {
  const { text } = req.body;

  const result = await analyzeJournalText(text);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Analysis complete"));
});

// GET /api/journal/insights/:userId
// Reads userId from params, delegates to service, returns 200 with aggregated stats.
const getJournalInsights = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const insights = await getInsightsByUserId(userId);

  return res
    .status(200)
    .json(new ApiResponse(200, insights, "Insights fetched"));
});

export { createJournalEntry, getJournalEntries, analyzeText, getJournalInsights };
