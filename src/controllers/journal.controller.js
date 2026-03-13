import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { createEntry, getEntriesByUser } from "../services/journal.service.js";

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

export { createJournalEntry, getJournalEntries };
