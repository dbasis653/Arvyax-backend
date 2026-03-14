import crypto from "crypto";
import prisma from "../db/prisma.js";
import { ExternalServiceError } from "../utils/api-error.js";
import {
  LLM_URL,
  LLM_MODEL,
  LLM_TEMPERATURE,
} from "../constants/llm.constants.js";

// Builds a prompt that instructs the model to respond in exactly two lines:
//   Line 1 — a plain-prose summary sentence (streamed live to the client)
//   Line 2 — raw JSON with emotion and keywords (parsed silently after streaming ends)
// Keeping the summary as plain prose lets us stream meaningful text to the user
// without exposing raw JSON tokens in the UI.
const buildPrompt = (text) =>
  `
You are a journal emotion analyst.
Analyze the journal entry below. Your entire response must be exactly two lines:

First line: a single sentence describing the user's mental state (plain text, no labels, no quotes).
Second line: {"emotion":"string","keywords":["string","string","string"]}

Rules:
- First line: plain prose sentence only — no prefixes, no markdown, no quotes around it
- Second line: raw JSON only — emotion (one short word e.g. calm, anxious, happy, sad, stressed), keywords (3 to 6 words or phrases from the text)
- Write nothing before the first line and nothing after the second line

Journal:
"""${text}"""
`.trim();

// Sends a prompt to Groq with stream:true and yields summary tokens via onChunk as they arrive.
// Streams only the first line (summary prose) to onChunk — JSON tokens on line 2 are silently accumulated.
// Returns the full two-line string once the stream ends.
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

  // 3. Read the SSE stream token by token
  //    Forward summary tokens (line 1, before first \n) to onChunk.
  //    Silently accumulate JSON tokens (line 2, after first \n).
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  let buffer = "";
  let summaryDone = false;

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
        // Only forward summary tokens (before the first newline) to the client
        if (!summaryDone) {
          const newlineIdx = text.indexOf("\n");
          if (newlineIdx === -1) {
            // Still inside the summary line — forward the whole token
            onChunk(text);
          } else {
            // Newline found — forward only the portion before it, then stop
            if (newlineIdx > 0) onChunk(text.slice(0, newlineIdx));
            summaryDone = true;
          }
        }
        accumulated += text;
      }
    }
  }

  return accumulated;
};

// Parses and validates the two-line response returned by the model.
// Line 1 becomes the summary. Line 2 is parsed as JSON for emotion and keywords.
// Throws ExternalServiceError if the format is wrong or required fields are missing.
const parseAndValidate = (rawContent) => {
  // 1. Strip markdown code fences if the model wrapped the output anyway
  const cleaned = rawContent
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  // 2. Split into summary (line 1) and JSON (line 2)
  const newlineIdx = cleaned.indexOf("\n");
  if (newlineIdx === -1) {
    throw new ExternalServiceError("LLM returned unexpected response format");
  }

  const summaryLine = cleaned.slice(0, newlineIdx).trim();
  const jsonLine = cleaned.slice(newlineIdx + 1).trim();

  // 3. Parse the JSON line for emotion and keywords
  let parsed;
  try {
    parsed = JSON.parse(jsonLine);
  } catch {
    throw new ExternalServiceError("LLM returned invalid JSON");
  }

  if (
    typeof parsed.emotion !== "string" ||
    !Array.isArray(parsed.keywords)
  ) {
    throw new ExternalServiceError("LLM returned unexpected response format");
  }

  return {
    emotion: parsed.emotion.trim().toLowerCase(),
    keywords: parsed.keywords.map((k) => String(k).trim()),
    summary: summaryLine,
  };
};

// Orchestrates the full analysis pipeline for a journal text:
//   1. Check AnalysisCache by SHA-256 hash of the text
//   2. Return cached result immediately if found — onChunk is never called on a cache hit
//   3. Stream summary tokens from Groq via callLLMStream, calling onChunk for each
//   4. Parse and validate the accumulated two-line response
//   5. Save the result to AnalysisCache for future lookups
//   6. Return { emotion, keywords, summary }
// onChunk(text) — called for each summary token during a live LLM call; skipped on cache hits
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

  // 3. Build prompt, stream the model response, and validate the output
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
