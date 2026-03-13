# Claude Instructions for this Project

## Code Separation Rules (always follow these)

### Constants

- Never define reusable constants inline in a component or page file.
- All constants go in `lib/constants/<topic>.ts`.
- If a constant is only used in one file and has zero reuse potential, it can stay local. If there is any chance it will be used elsewhere, extract it immediately.
- Examples: social media formats, crop presets, tool definitions, upload limits, folder names, transformation configs.

### Shared Utilities / Singletons

- Third-party SDK configs that are used in more than one file go in `lib/<service>.ts`.
- Example: `lib/cloudinary.ts`, `lib/prisma.ts` — never repeat `.config()` calls across route files.

### Components

- If a UI pattern appears in more than one place, extract it to `components/ui/<ComponentName>.tsx`.
- Feature-specific components go in `components/<feature>/`.
- Page-specific one-off UI that has no reuse potential can stay in the page file.

### Types

- Shared types and interfaces go in `types/` or co-located with their constants file (e.g. `SocialFormat` lives in `lib/constants/socialFormats.ts`).
- Never duplicate a type definition across files.

### General Principle

Before writing any constant, component, or utility inline — ask: "Could this be needed elsewhere?"
If yes, put it in the right shared location from the start.

## Code Comments (always follow these)

### Imports

- Do not add comments above import statements. Leave all imports clean with no comments.

### Functions and Hooks

- Every non-trivial function (more than 2–3 lines or non-obvious logic) must have a comment above it explaining:
  - What it does
  - What it takes as input and what it returns (if not obvious from the name/types)
- Example:
  ```ts
  // Calculates a centered crop box that fits within imgW × imgH while preserving the given aspect ratio.
  // Returns a PixelCrop ready to pass directly to react-image-crop.
  function makeCenteredCrop(aspect: number, imgW: number, imgH: number): PixelCrop { ... }
  ```

### Logic Blocks inside Functions

- Non-obvious steps inside a function must be prefixed with a numbered or descriptive comment.
- Example:

  ```ts
  // 1. Authenticate — must be outside try/catch so the 401 is returned correctly
  const { userId } = await auth();

  // 2. Look up DB user row — webhook creates this on first sign-up
  const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });

  // 3. Upload to Cloudinary with auto quality compression
  const result = await new Promise(...)
  ```

### JSX Sections

- Major JSX blocks must have a short comment label. Use the existing `{/* ── Label ── */}` style.
- Example:
  ```tsx
  {
    /* ── Preset buttons ── */
  }
  {
    /* ── Crop canvas + preview ── */
  }
  {
    /* ── Action buttons ── */
  }
  ```

### What NOT to comment

- Do not comment self-evident one-liners (e.g. `useState`, simple assignments).
- Do not restate the code in plain English — explain the _why_, not the _what_.

## Folder Structure Reference

```
lib/
  cloudinary.ts              ← Cloudinary singleton
  prisma.ts                  ← Prisma singleton
  constants/
    socialFormats.ts
    cropPresets.ts
    playgroundTools.ts
    uploadLimits.ts
    ...

components/
  ui/                        ← generic reusable UI (Button, Modal, Spinner, etc.)
  <feature>/                 ← feature-specific components (video/, image/, playground/, etc.)

types/                       ← shared TypeScript types/interfaces
```

## API Design Rules

- Keep route handlers thin. Business logic must live in services, not directly inside route files.
- Controllers should only:
  1. read request data
  2. call service functions
  3. return HTTP responses
- Use consistent response shapes for success and error cases.
- Use proper HTTP status codes:
  - 200 for success
  - 201 for created resources
  - 400 for validation errors
  - 404 for not found
  - 500 for unexpected server errors
- Never put database logic and LLM logic directly in route files.
- Each route should validate input before calling a service.

## Validation and Error Handling

- Validate every request body, params, and query before processing.
- Never trust frontend input.
- Return user-friendly error messages for validation failures.
- Use a centralized error handler middleware.
- Create shared error classes for known errors (ValidationError, NotFoundError, ExternalServiceError).
- Wrap async controllers with a common async handler instead of repeating try/catch everywhere.
- Never leak raw stack traces or secret values in API responses.

## Service Layer Rules

- Put business logic in `services/`.
- Put database queries in services or repositories, not in controllers.
- Keep services focused: one service should solve one responsibility.
- If logic talks to an external API like an LLM, isolate it in a dedicated service file.
- Controllers must not contain heavy branching or transformation logic.

## Data Modeling Rules

- Prisma models must be normalized unless there is a clear performance reason not to.
- Add indexes for fields frequently used in lookups and filters.
- Use enums for restricted values like ambience when possible.
- Include `createdAt` and `updatedAt` on core models.
- Prefer explicit relations over duplicating related data.
- Name fields clearly and consistently across DB, services, and API responses.
- Avoid storing derived data unless it is intentionally cached.

## LLM Integration Rules

- All LLM calls must live in a dedicated `services/llm.service.ts` file.
- Prompts must be deterministic, minimal, and structured for machine parsing.
- Always ask the LLM to return strict JSON when the response is consumed by backend code.
- Validate and sanitize LLM output before storing or returning it.
- Implement graceful fallback handling when the LLM fails or returns invalid output.
- Cache repeated analysis results when the same journal text is analyzed again.
- Never hardcode fake analysis responses in production code.
- Keep model/provider config centralized in shared constants or config files.

## Security Rules

- Never hardcode secrets, API keys, or database URLs.
- All secrets must come from environment variables.
- Do not log sensitive journal text unless explicitly needed for debugging.
- Sanitize and validate all input before use.
- Apply rate limiting to public endpoints when possible.
- Return generic error messages for sensitive failures.

## Testing Rules

- Critical backend logic should be written in a way that is easy to test.
- Keep pure calculation logic separate from Express request/response objects.
- Prefer unit-testable service functions over large controller functions.

## Naming and Consistency Rules

- Use consistent naming across database models, API payloads, service functions, and frontend types.
- Avoid ambiguous names like `data`, `info`, `result` when a clearer domain name is possible.
- Use singular names for models and plural names for collections/lists where appropriate.
- Keep folder and file naming predictable and feature-oriented.
