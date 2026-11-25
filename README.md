# unfold

A personal library that captures what you find interesting, remembers *why*, and lets you find it again later.

See [`docs/architecture.md`](docs/architecture.md) for the design. **Current state: Phase 1 (Retrieval).**

## Layout

```
web/                  Next.js app (UI + API) and the worker (src/worker)
  src/lib/            capture, data access, search, URL normalisation, SSRF-safe fetcher, metadata, text extraction
  src/lib/ai/         Claude (summary, tags, "why related") and Voyage embeddings
  src/worker/         pg-boss worker: metadata step, then enrich (content -> summary + tags -> embedding)
extension/            Chrome MV3 extension (popup + Ctrl/Cmd+Shift+S)
supabase/migrations/  SQL schema (discovery, api_token, relation, pgvector, RLS)
```

## Setup

Requires Node 22.9+ and pnpm 10.

```bash
pnpm install
cp web/.env.example web/.env.local   # fill in Supabase values
```

### Supabase

1. Apply the migrations in order: paste each `supabase/migrations/*.sql` into the SQL editor, or `supabase db push` with the CLI. Phase 1 enables the `vector` extension.
2. **Auth → URL Configuration:** set Site URL to your app URL and add `http://localhost:3000/auth/callback` (plus your production `/auth/callback`) to Redirect URLs.
3. Auth → Providers: Email (magic link) is used by default.

### AI (Phase 1)

Set these in `web/.env.local` for both the app and the worker. Each is optional:

| Key | Enables | Without it |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI summary + 3-7 tags per item; "Why related?" explanations | Items keep the page's own description |
| `VOYAGE_API_KEY` | Embeddings: vague-description search and related items | Search is full-text only; no related items |

One Claude call per item (`claude-opus-5-5` at low effort by default; override with `ENRICH_MODEL`). Page text is fetched, truncated to ~12k characters, sent as quoted data and never stored. On start the worker backfills items saved before the keys were set.

### Run

```bash
pnpm worker   # once first: creates the pg-boss schema and queue
pnpm dev      # http://localhost:3000
```

The worker must be running for saved items to get titles, favicons, summaries and embeddings. Items saved while it's down stay `pending` and are swept up on restart.

### Extension

```bash
pnpm --filter unfold-extension build
```

Load `extension/dist` via `chrome://extensions` → Developer mode → Load unpacked. In the web app, open **Settings → Create token**, then paste the app URL and token into the extension's options page.

### Mobile (PWA share target)

Deploy over HTTPS, open the app on Android Chrome, and choose **Install app**. "unfold" then appears in the system share sheet. (iOS Safari doesn't support Web Share Target.)

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Deploy notes

- **Web:** Vercel (or any Node host). Set the env vars from `.env.example`.
- **Worker:** a long-running process (Railway, Fly.io, Render, a VPS): `pnpm --filter web worker`. It can't run on Vercel serverless.
- `DATABASE_URL` should use Supabase's session pooler (port 5432) or a direct connection.

## Security notes

- The server connects to Postgres directly (bypassing RLS), so every query in `src/lib/discoveries.ts` and `src/lib/tokens.ts` filters by `user_id`. RLS stays enabled as defence in depth.
- The fetcher (`src/lib/fetcher.ts`) only allows public unicast IPs, checked at connect time (DNS-rebinding safe), re-validated on every redirect, with size and time caps.
- Extension tokens are stored as SHA-256 hashes, and the plaintext is shown once.
