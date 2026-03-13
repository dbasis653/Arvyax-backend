import prisma from "../db/prisma.js";
import { NotFoundError } from "../utils/api-error.js";

// Creates a new journal entry for the given user.
// Accepts { username, ambience, text }, resolves username to userId, and persists to DB.
// Throws NotFoundError if no user with that username exists.
// Returns the created JournalEntry record.
const createEntry = async ({ username, ambience, text }) => {
  // 1. Resolve username to the internal user id
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new NotFoundError("User not found");

  // 2. Persist the entry using the resolved id
  const entry = await prisma.journalEntry.create({
    data: { userId: user.id, ambience, text },
  });
  return entry;
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

export { createEntry, getEntriesByUser };
