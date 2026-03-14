// Maximum request body size accepted by the Express JSON and URL-encoded parsers.
const PAYLOAD_LIMIT = "16kb";

// Rate limiter settings for LLM-backed endpoints.
// 10 requests per 15 minutes per IP to protect Groq API quota.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_HEADERS = "draft-8";

// Valid ambience values for journal entries.
const AMBIENCE_OPTIONS = ["forest", "ocean", "mountain"];

// Maximum allowed length for journal entry text.
const MAX_TEXT_LENGTH = 5000;

export {
  PAYLOAD_LIMIT,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
  RATE_LIMIT_HEADERS,
  AMBIENCE_OPTIONS,
  MAX_TEXT_LENGTH,
};
