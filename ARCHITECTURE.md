# Arvyax — Architecture

---

## 1. How Would You Scale This to 100k Users?

### Horizontal scaling behind a load balancer

The Express API is fully stateless — no server-side sessions, no in-memory state. Any instance can handle any request. Add more instances behind a load balancer as traffic grows.

```
                        ┌──────────────┐
                        │ Load Balancer │  (Nginx / AWS ALB)
                        └──────┬───────┘
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
        [Express #1]    [Express #2]    [Express #3]
               └───────────────┼───────────────┘
                               ▼
                        [PostgreSQL on Neon]
```

### Database connection pooling

Postgres supports ~100 concurrent connections before it degrades. At 100k users, raw connections from multiple Express instances will hit that ceiling fast. Use **PgBouncer** or Neon's built-in pooler to multiplex thousands of app connections into a small pool of real DB connections.

### Move LLM calls off the HTTP worker

The streaming analysis endpoint holds an HTTP connection open for several seconds while waiting on Groq. At scale this blocks Express workers and limits concurrency.

Move analysis to a **background job queue** (BullMQ + Redis):

```
POST /api/journal/:id/analyze
  │
  ▼
Enqueue job → return 202 Accepted immediately
  │
Background worker → calls Groq → saves result to DB
  │
Frontend polls until analyzedAt is set
```

---

## 2. How Would You Reduce LLM Cost?

### Analysis caching (already implemented)

The biggest cost reduction is already built in. Before every LLM call, the text is SHA-256 hashed and checked against `AnalysisCache`. If the same text has been analyzed before, the cached result is returned immediately — no Groq call, no cost. See Section 3 for full details.

### Use a smaller model for simple entries

The current model (`llama-3.1-8b-instant`) is fast and cheap. For short or simple journal entries (under ~100 words), a smaller model produces equally accurate emotion analysis. Reserve larger models only if output quality becomes insufficient.

### Keep prompts minimal

The current prompt is ~10 lines with no examples, no chain-of-thought, and a strict two-line output format. Longer prompts consume more tokens on every call. The prompt should stay as short as possible while remaining reliable.

### Rate limiting (already implemented)

LLM-backed endpoints are limited to **10 requests per 15 minutes per IP**. This prevents a single user from exhausting API quota through rapid repeated calls, which also protects cost.

### Analyze on demand, not on creation

Journal entries are created without triggering LLM analysis. Analysis only runs when the user explicitly clicks Analyze. This means entries that are never analyzed never cost anything.

---

## 3. How Would You Cache Repeated Analysis?

### What is already built

Every call to `analyzeJournalText()` in `llm.service.js` follows this flow:

```
Input text
  │
  ▼
Normalize: lowercase + trim
  │
  ▼
SHA-256 hash
  │
  ▼
CHECK AnalysisCache WHERE textHash = hash
  │
  ├── Cache HIT  → return { emotion, keywords, summary } immediately
  │               (onChunk is never called — no streaming, no Groq call)
  │
  └── Cache MISS → call Groq with stream: true
                   → parse two-line response
                   → INSERT into AnalysisCache
                   → return result
```

The hash is computed from the **normalized** text (lowercased, trimmed) so minor whitespace differences do not produce duplicate cache entries for the same content.

### Why a DB cache instead of in-memory

An in-memory cache (e.g. a plain JS `Map`) would be lost on every server restart and would not be shared across multiple Express instances. The `AnalysisCache` table is persistent and shared across all instances — a cache entry written by instance #1 is immediately available to instance #2.

### Adding Redis as a faster cache layer

For very high traffic, a DB lookup on every analysis call adds latency. Redis can sit in front of the DB cache:

```
Hash
  │
  ▼
CHECK Redis (in-memory, ~0.1ms)
  │
  ├── HIT  → return immediately
  │
  └── MISS → CHECK AnalysisCache DB (~5ms)
               │
               ├── HIT  → write to Redis → return
               │
               └── MISS → call Groq → write to DB + Redis → return
```

### Cache expiry (optional)

Currently cached entries never expire. If the LLM model is upgraded in the future and produces meaningfully better results, a `createdAt`-based TTL can be added to the cache so old analyses are gradually replaced.

---

## 4. How Would You Protect Sensitive Journal Data?

Journal entries contain personal emotional content. Protection applies at every layer.

### Transport security

All traffic in production runs over **HTTPS**. TLS is terminated at the reverse proxy (Nginx / load balancer). Journal text never travels in plaintext over the network.

### Secrets management

`GROQ_API_KEY` and `DATABASE_URL` live in environment variables and are never committed to the repository. `.env` is gitignored. In production, secrets are injected via the hosting platform's secret manager (e.g. Railway, Render, AWS Secrets Manager).

### No sensitive data in logs or error responses

`error-handler.js` strips all internal details before responding — clients only see a human-readable message string. Stack traces, query details, and journal text are never logged to a public surface or returned in API responses.

### Input validation on every endpoint

Every route runs `express-validator` rules before the request reaches a service. Malformed or oversized input is rejected at the boundary with a `400` — it never touches the database or the LLM.

### Rate limiting

LLM endpoints are rate-limited to 10 requests per 15 minutes per IP. This prevents an attacker from enumerating or scraping journal content through rapid repeated calls.

### CORS locked to the frontend origin

In production, `CORS_ORIGIN` is set to the deployed frontend URL — not `*`. Requests from unknown origins are blocked at the HTTP level before they reach any route handler.

### Cascade delete for data removal

The `User` → `JournalEntry` relation uses `onDelete: Cascade`. Deleting a user removes all their journal entries from the database automatically. This supports GDPR-style right-to-erasure without requiring a custom cleanup query.

### Authentication (next step)

The current implementation uses username-only access. `bcrypt` and `jsonwebtoken` are already installed. Adding full auth would mean:

- Hashing passwords with bcrypt on registration
- Issuing a JWT on login
- Adding JWT middleware to all journal routes so users can only read and write their own entries

Until auth is added, the API trusts the username provided in the request. This is acceptable for an MVP but should be addressed before exposing the API publicly.

### Field-level encryption (maximum sensitivity)

For the highest level of protection, the `text` column of `JournalEntry` can be encrypted at the application layer before being written to the database. This means even a database breach exposes only ciphertext. The encryption key would live in the secret manager, never in the database itself.
