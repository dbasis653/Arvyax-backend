import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

// Adapter is created lazily on first use so that DATABASE_URL is guaranteed
// to be loaded from .env before the connection string is read.
let prisma;
if (!prisma) {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  prisma = new PrismaClient({ adapter });
}

export default prisma;
