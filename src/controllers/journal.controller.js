import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { createEntry, getEntriesByUser, getInsightsByUserId, analyzeAndUpdateEntry, findEntryById } from "../services/journal.service.js";
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

// POST /api/journal/:id/analyze
// Streams LLM analysis for the given entry as Server-Sent Events.
// Emits { type:'chunk', text } for each token, { type:'done', entry } on completion,
// and { type:'error', message } on failure. Cannot use asyncHandler because SSE headers
// are flushed before async work begins, preventing Express from sending error responses.
const analyzeEntryById = async (req, res) => {
  const { id } = req.params;

  // 1. Confirm entry exists before flushing SSE headers — allows a normal 404 response if missing
  const exists = await findEntryById(id);
  if (!exists) {
    return res.status(404).json({ success: false, message: "Journal entry not found" });
  }

  // 2. Open the SSE connection
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // 3. Wire client disconnect to abort the in-flight Groq request
  const ac = new AbortController();
  let aborted = false;
  req.on("close", () => {
    aborted = true;
    ac.abort();
  });

  const sendEvent = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  // 4. Stream tokens to the client as they arrive; stop writing if client disconnected
  const onChunk = (text) => {
    if (!aborted) sendEvent({ type: "chunk", text });
  };

  try {
    const updatedEntry = await analyzeAndUpdateEntry(id, onChunk, ac.signal);
    sendEvent({ type: "done", entry: updatedEntry });
  } catch (err) {
    sendEvent({ type: "error", message: err.message || "Analysis failed" });
  } finally {
    res.end();
  }
};

export { createJournalEntry, getJournalEntries, analyzeText, getJournalInsights, analyzeEntryById };
