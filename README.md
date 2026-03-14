# Arvyax — Backend

**Live frontend:** [arvyax-ai-journal.vercel.app](https://arvyax-ai-journal.vercel.app)

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

Server runs on `http://localhost:5000` in development.
Production API: https://arvyax-backend-ymgk.onrender.com

---

## Bonus Features Implemented

- **Streaming LLM response** — `POST /api/journal/:id/analyze` streams analysis via SSE, word by word
- **Caching analysis results** — `AnalysisCache` table stores SHA-256 hash of each text; cache hits skip Groq entirely
- **Rate limiting** — LLM endpoints limited to 10 requests per 15 minutes per IP
- **Deployed demo** — live at [arvyax-ai-journal.vercel.app](https://arvyax-ai-journal.vercel.app)

---

## What It Does

- **Login page** — enter a username to access your journal
- **Journal page** — write entries with an ambience (forest / ocean / mountain)
- **Live analysis** — click Analyze on any entry to stream the LLM summary word by word
- **Insights panel** — top emotion, most used ambience, recent keywords across all entries

---

## API Endpoints

LLM endpoints are rate-limited to **10 requests per 15 minutes per IP**.

---

### `POST /api/users` — Create user

```json
{ "username": "alice" }
```

### `POST /api/users/login` — Login

```json
{ "username": "alice" }
```

### `POST /api/journal` — Create journal entry

```json
{
  "username": "alice",
  "ambience": "forest",
  "text": "I felt calm today after listening to the rain."
}
```

> `ambience` must be one of: `forest`, `ocean`, `mountain`. `text` max 5000 characters.

### `GET /api/journal/:username` — Get all entries for a user

No body. Replace `:username` with the user's username.

> Note: We use :username instead of :userId for this route in this assignment

### `POST /api/journal/analyze` — Abrogate

> Note: this endpoint returns a plain JSON response. For live streaming, I need to change it to `POST /api/journal/:id/analyze` instead — it was introduced specifically to implement SSE streaming so the summary appears word by word in the UI.

### `POST /api/journal/:id/analyze` — Stream analysis for an entry (SSE)

> Note: Get the :id with `GET /api/journal/:username`

No body. Replace `:id` with the journal entry's CUID.
Returns a `text/event-stream` with events:

```
data: {"type":"chunk","text":"The user feels..."}
data: {"type":"done","entry":{...}}
data: {"type":"error","message":"..."}
```

### `GET /api/journal/insights/:userId` — Get insights for a user

No body. Replace `:userId` with the user's CUID (returned from create/login).

---

For full response shapes see [DOCUMENTATION.md](DOCUMENTATION.md).
For architecture decisions see [ARCHITECTURE.md](ARCHITECTURE.md).
