import crypto from "crypto";
import prisma from "../db/prisma.js";
import { ExternalServiceError } from "../utils/api-error.js";
import {
  LLM_URL,
  LLM_MODEL,
  LLM_TEMPERATURE,
} from "../constants/llm.constants.js";

// Builds a strict, deterministic prompt that instructs the model to return
// only a JSON object with emotion, keywords, and summary — no extra text.
const buildPrompt = (text) =>
  `
You are a journal emotion analyst.
Analyze the journal entry below and return ONLY valid JSON in this exact format:
{
  "emotion": "string",
  "keywords": ["string", "string", "string"],
  "summary": "string"
}

Rules:
- emotion: one short word (e.g. calm, anxious, happy, sad, stressed)
- keywords: 3 to 6 important words or phrases from the text
- summary: exactly one sentence describing the user's mental state
- return raw JSON only — no markdown, no explanation, no code fences

Journal:
"""${text}"""
`.trim();

// Sends a prompt to Groq with stream:true and yields token chunks via onChunk as they arrive.
// Accumulates all tokens and returns the full string once the stream ends.
// Accepts an optional AbortSignal to cancel the in-flight request (e.g. on client disconnect).
// Throws ExternalServiceError if the HTTP request fails or returns a non-OK status.
const callLLMStream = async (prompt, onChunk, signal) => {
  // 1. Send streaming request to Groq chat completions endpoint
  const response = await fetch(LLM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: LLM_TEMPERATURE,
      stream: true,
    }),
    signal,
  });

  // 2. Treat any non-2xx status as an external service failure
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ExternalServiceError(
      `LLM request failed: ${response.status} ${JSON.stringify(errorBody)}`,
    );
  }

  // 3. Read the SSE stream, extract delta tokens, call onChunk for each, accumulate full text
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Append decoded bytes to buffer; keep last incomplete line for the next iteration
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return accumulated;

      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }

      const text = parsed?.choices?.[0]?.delta?.content;
      if (text != null) {
        accumulated += text;
        onChunk(text);
      }
    }
  }

  return accumulated;
};

// Parses and validates the raw string returned by the model.
// Ensures the output matches the expected shape before it is stored or returned.
// Throws ExternalServiceError if JSON is malformed or required fields are missing/wrong type.
const parseAndValidate = (rawContent) => {
  let parsed;

  // 1. Strip markdown code fences if the model wrapped the JSON anyway
  const cleaned = rawContent
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ExternalServiceError("LLM returned invalid JSON");
  }

  // 2. Validate required fields and their types
  if (
    typeof parsed.emotion !== "string" ||
    !Array.isArray(parsed.keywords) ||
    typeof parsed.summary !== "string"
  ) {
    throw new ExternalServiceError("LLM returned unexpected response format");
  }

  return {
    emotion: parsed.emotion.trim().toLowerCase(),
    keywords: parsed.keywords.map((k) => String(k).trim()),
    summary: parsed.summary.trim(),
  };
};

// Orchestrates the full analysis pipeline for a journal text:
//   1. Check AnalysisCache by SHA-256 hash of the text
//   2. Return cached result immediately if found — onChunk is never called on a cache hit
//   3. Stream tokens from Groq via callLLMStream, calling onChunk for each token
//   4. Parse and validate the accumulated response
//   5. Save the result to AnalysisCache for future lookups
//   6. Return { emotion, keywords, summary }
// onChunk(text) — called for each token chunk during a live LLM call; skipped on cache hits
// signal — optional AbortSignal to cancel the Groq request mid-stream
const analyzeJournalText = async (text, onChunk, signal) => {
  // 1. Hash the normalized text to use as a cache key
  const textHash = crypto
    .createHash("sha256")
    .update(text.trim().toLowerCase())
    .digest("hex");

  // 2. Return early if this exact text has been analyzed before
  const cached = await prisma.analysisCache.findUnique({ where: { textHash } });
  if (cached) {
    return {
      emotion: cached.emotion,
      keywords: cached.keywords,
      summary: cached.summary,
    };
  }

  // 3. Build prompt, stream the model response token by token, and validate the output
  const prompt = buildPrompt(text);
  const rawContent = await callLLMStream(prompt, onChunk, signal);
  const result = parseAndValidate(rawContent);

  // 4. Persist to cache so the same text is never sent to the LLM again
  await prisma.analysisCache.create({
    data: {
      textHash,
      originalText: text,
      emotion: result.emotion,
      keywords: result.keywords,
      summary: result.summary,
    },
  });

  return result;
};

export { analyzeJournalText };
