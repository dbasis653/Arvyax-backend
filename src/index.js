import "dotenv/config"; // must be first — loads .env before any other module runs
import app from "./app.js";
import prisma from "./db/prisma.js";

const port = process.env.PORT || 3000;

async function main() {
  await prisma.$connect();
  console.log("Database connected");

  app.listen(port, () => {
    console.log(`App is listening on the port http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error("Database connection error", err);
  process.exit(1);
});
