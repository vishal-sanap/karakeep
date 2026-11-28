# unfold

A personal library that captures what you find interesting, remembers *why*, and lets you find it again later.

See [`docs/architecture.md`](docs/architecture.md) for the design. **Current state: Phase 3 (Tiles).** Everything runs locally: no AI API keys.

## Layout

```
web/                  Next.js app (UI + API) and the worker (src/worker)
  src/lib/            capture, data access, search, rediscover, URL normalisation, SSRF-safe fetcher, metadata,
                      text extraction, keywords (extractive summary, tags, thread names)
  src/lib/ai/         local embeddings (bge-small-en-v1.5 via transformers.js)
  src/lib/threads/    clustering, stable thread ids, build + queries
  src/worker/         pg-boss worker: metadata -> enrich (content, summary + tags, embedding); nightly threads
extension/            Chrome MV3 extension (popup + Ctrl/Cmd+Shift+S)
supabase/migrations/  SQL schema (discovery, api_token, relation, thread, pgvector, RLS)
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

### Local AI (no keys)

Summaries, tags and embeddings are computed on your machine; nothing is sent to an AI service.

- **Embeddings:** `Xenova/bge-small-en-v1.5` (384-dim, quantized) via transformers.js. Downloaded once (~35 MB) into `web/.cache/models` on first use; about 0.3-0.5 GB RAM across the worker and web server. Powers vague-description search, related items and threads.
- **Summary:** the page's own description, or its first two substantial sentences.
- **Tags:** keyword extraction from title, description and page text, weighted against your library.
- **Threads:** nightly average-linkage clustering of the embeddings (03:00 UTC; `THREADS_CRON` / `THREADS_TZ`), only when the library changed. A thread needs 3+ items; names come from the members' shared keywords. "Rebuild threads" on the Threads page runs it now.
- **Rediscover:** never-opened items, older items related to this week's saves, and where active threads began.
- **Tiles:** an endless, draggable WebGL grid of your library (OGL), with momentum, a speed-based lens warp and edge fades. Preview images come through `/api/tiles/img/[id]`, a same-origin proxy that only serves the signed-in user's own thumbnails via the SSRF-hardened fetcher (raster formats only, no SVG). Falls back to an HTML grid without WebGL; honours reduced motion. **Ctrl+F / ⌘F** on the tiles page opens search over blurred tiles; picking a result glides to that item's tile and pulses it.
- **Bulk import / export:** Settings → Import links takes pasted text (any links in it), `.txt`, `.csv`, browser bookmark `.html` or an unfold `.json` export, parsed in the browser (up to 1,000 links per run, duplicates skipped). Export as JSON, CSV, browser bookmarks or a plain list via `/api/export?format=json|csv|html|txt`.

Page text is fetched, used, and discarded; only the summary, tags and embedding are stored. The worker re-processes items saved before an embedding-model change.

### Run

```bash
pnpm worker   # once first: creates the pg-boss schema and queue
pnpm dev      # http://localhost:3000
```

The worker must be running for saved items to get titles, favicons, summaries, tags, embeddings and threads. Items saved while it's down stay `pending` and are swept up on restart.

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

- **Web:** any Node host (`pnpm --filter web build && pnpm --filter web start`). Set the env vars from `.env.example`.
- **Worker:** a long-running process (Railway, Fly.io, Render, a VPS): `pnpm --filter web worker`. It can't run on Vercel serverless.
- **Web:** search embeds queries with the local model (native ONNX runtime), so host the web app on a regular Node server too, e.g. alongside the worker, rather than Vercel serverless functions.
- On Windows, stopping `pnpm worker` can leave its `node` child running and holding database connections; kill the whole process tree.
- `DATABASE_URL` should use Supabase's session pooler (port 5432) or a direct connection.

## Security notes

- The server connects to Postgres directly (bypassing RLS), so every query in `src/lib/discoveries.ts` and `src/lib/tokens.ts` filters by `user_id`. RLS stays enabled as defence in depth.
- The fetcher (`src/lib/fetcher.ts`) only allows public unicast IPs, checked at connect time (DNS-rebinding safe), re-validated on every redirect, with size and time caps.
- Extension tokens are stored as SHA-256 hashes, and the plaintext is shown once.
