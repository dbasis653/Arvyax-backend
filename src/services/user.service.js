import prisma from "../db/prisma.js";
import { ConflictError, NotFoundError } from "../utils/api-error.js";

// Creates a new user with the given username.
// Throws ConflictError if the username is already taken.
// Returns { id, username, createdAt } of the created user.
const createUser = async ({ username }) => {
  // 1. Guard against duplicate usernames before hitting the DB constraint
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) throw new ConflictError("Username already taken");

  // 2. Persist and return only safe, non-sensitive fields
  return prisma.user.create({
    data: { username },
    select: { id: true, username: true, createdAt: true },
  });
};

// Finds an existing user by username.
// Throws NotFoundError if no user with that username exists.
// Returns { id, username, createdAt } of the found user.
const loginUser = async ({ username }) => {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, createdAt: true },
  });

  if (!user) throw new NotFoundError("No account found with that username");

  return user;
};

export { createUser, loginUser };
