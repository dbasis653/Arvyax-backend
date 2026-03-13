import prisma from "../db/prisma.js";
import { NotFoundError } from "../utils/api-error.js";
import { analyzeJournalText } from "./llm.service.js";

// Creates a new journal entry for the given user, then immediately analyzes it with the LLM.
// Accepts { username, ambience, text }, resolves username to userId, and persists to DB.
// Throws NotFoundError if no user with that username exists.
// Returns the JournalEntry record with emotion, keywords, summary, and analyzedAt already populated.
const createEntry = async ({ username, ambience, text }) => {
  // 1. Resolve username to the internal user id
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new NotFoundError("User not found");

  // 2. Persist the entry first so it gets an id regardless of analysis outcome
  const entry = await prisma.journalEntry.create({
    data: { userId: user.id, ambience, text },
  });

  // 3. Analyze the text via LLM (cache-backed) and write results back to the entry.
  // Wrapped in try/catch so an LLM failure never prevents the entry from being saved —
  // analysis fields stay null and the entry is still returned successfully.
  try {
    const analysis = await analyzeJournalText(text);
    const analyzed = await prisma.journalEntry.update({
      where: { id: entry.id },
      data: {
        emotion: analysis.emotion,
        keywords: analysis.keywords,
        summary: analysis.summary,
        analyzedAt: new Date(),
      },
    });
    return analyzed;
  } catch {
    return entry;
  }
};

// Fetches all journal entries for a given username, newest first.
// Throws NotFoundError if no user with that username exists.
// Returns an array of JournalEntry records (may be empty).
const getEntriesByUser = async (username) => {
  // 1. Resolve username to confirm the user exists and get their id
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new NotFoundError("User not found");

  // 2. Fetch entries ordered by creation date, most recent first
  const entries = await prisma.journalEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return entries;
};

// Aggregates journal stats for a given userId.
// Returns { totalEntries, topEmotion, mostUsedAmbience, recentKeywords }.
// Throws NotFoundError if no user with that id exists.
const getInsightsByUserId = async (userId) => {
  // 1. Confirm the user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");

  // 2. Fetch all entries newest-first so recentKeywords reflects recency order
  const entries = await prisma.journalEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  // 3. Total count is a straight length
  const totalEntries = entries.length;

  // 4. Count emotion occurrences across analyzed entries, pick the highest
  const emotionCounts = {};
  for (const entry of entries) {
    if (entry.emotion) {
      emotionCounts[entry.emotion] = (emotionCounts[entry.emotion] ?? 0) + 1;
    }
  }
  const topEmotion =
    Object.keys(emotionCounts).length > 0
      ? Object.keys(emotionCounts).reduce((a, b) =>
          emotionCounts[a] >= emotionCounts[b] ? a : b,
        )
      : null;

  // 5. Count ambience occurrences, pick the highest
  const ambienceCounts = {};
  for (const entry of entries) {
    ambienceCounts[entry.ambience] =
      (ambienceCounts[entry.ambience] ?? 0) + 1;
  }
  const mostUsedAmbience =
    Object.keys(ambienceCounts).length > 0
      ? Object.keys(ambienceCounts).reduce((a, b) =>
          ambienceCounts[a] >= ambienceCounts[b] ? a : b,
        )
      : null;

  // 6. Collect unique keywords from the 10 most recent entries, preserving order
  const seen = new Set();
  const recentKeywords = [];
  for (const entry of entries.slice(0, 10)) {
    for (const kw of entry.keywords ?? []) {
      if (!seen.has(kw)) {
        seen.add(kw);
        recentKeywords.push(kw);
      }
    }
  }

  return { totalEntries, topEmotion, mostUsedAmbience, recentKeywords };
};

export { createEntry, getEntriesByUser, getInsightsByUserId };
