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

// Sends a prompt to Groq and returns the raw text content from the model's reply.
// Uses temperature 0.2 for consistent, deterministic structured output.
// Throws ExternalServiceError if the HTTP request fails or returns a non-OK status.
const callLLM = async (prompt) => {
  // 1. Send request to Groq chat completions endpoint
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
    }),
  });

  // 2. Treat any non-2xx status as an external service failure
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ExternalServiceError(
      `LLM request failed: ${response.status} ${JSON.stringify(errorBody)}`,
    );
  }

  // 3. Extract the model's text reply from the choices array
  const data = await response.json();
  const rawContent = data?.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new ExternalServiceError("LLM returned an empty response");
  }

  return rawContent;
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
//   2. Return cached result immediately if found (avoids redundant LLM calls)
//   3. Call OpenRouter and parse the response
//   4. Save the result to AnalysisCache for future lookups
//   5. Return { emotion, keywords, summary }
const analyzeJournalText = async (text) => {
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

  // 3. Build prompt, call the model, and validate the output
  const prompt = buildPrompt(text);
  const rawContent = await callLLM(prompt);
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
