# Arvyax — Backend

Express API for the Arvyax AI-assisted journaling system. Handles journal entries, LLM emotion analysis (streamed via SSE), user insights, and analysis caching.

---

## Tech Stack

- Node.js + Express 5 (ES Modules)
- PostgreSQL via [Neon](https://neon.tech) + Prisma 7
- Groq API for LLM (llama-3.3-70b-versatile), streamed via SSE
- express-rate-limit, express-validator

---

## Prerequisites

- Node.js v18+
- A [Neon](https://neon.tech) PostgreSQL database (free tier works)
- A [Groq](https://console.groq.com) API key (free tier works)

---

## Environment Variables

Create a `.env` file in the project root:

```
PORT=5000
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
GROQ_API_KEY=your_groq_api_key_here
```

---

## Install & Run

```bash
npm install

# Apply DB migrations and generate Prisma client
npx prisma migrate deploy
npx prisma generate

npm run dev     # development (auto-restart via Nodemon)
npm start       # production
```

Server runs on `http://localhost:5000`.

---

## API Endpoints

| Method | Endpoint                        | Description                                 |
| ------ | ------------------------------- | ------------------------------------------- |
| POST   | `/api/users`                    | Create a user (`username` required)         |
| POST   | `/api/journal`                  | Create a journal entry                      |
| GET    | `/api/journal/:username`        | Get all entries for a user                  |
| POST   | `/api/journal/analyze`          | Analyze text with LLM (cache-backed)        |
| POST   | `/api/journal/:id/analyze`      | Stream live LLM analysis for an entry (SSE) |
| GET    | `/api/journal/insights/:userId` | Get aggregated insights for a user          |

LLM endpoints are rate-limited to **10 requests per 15 minutes per IP**.

For full request/response shapes see [DOCUMENTATION.md](DOCUMENTATION.md).
For architecture decisions see [ARCHITECTURE.md](ARCHITECTURE.md).
