# Handoff

Where unfold stands as of 28 Nov 2026, and how to pick it up on another machine.

unfold is a personal library: save a link with a short "why" note, then find it again later through search, Tiles, threads and rediscovery. Everything runs locally and costs nothing. There's no Anthropic, Voyage or other paid API.

## Run it

```sh
pnpm install
cp web/.env.example web/.env.local   # then fill in the values below
pnpm --filter web dev --port 3005    # app at http://localhost:3005
cd web && pnpm worker                # background jobs (second terminal)
```

`web/.env.local` needs these values:

| Variable | Required? | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Required | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Required | The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` also works. |
| `DATABASE_URL` | Required | Supabase session pooler on port 5432, which pg-boss needs. |
| `YOUTUBE_API_KEY` | Optional | Richer YouTube metadata. |
| `MODEL_CACHE_DIR` | Optional | Where the model is cached. |
| `THREADS_CRON`, `THREADS_TZ` | Optional | Nightly thread rebuild schedule, default `0 3 * * *` UTC. |

Migrations are in `supabase/migrations/` and are already applied to the current project. Apply them in order on a fresh project.

The first search or enrich run downloads the embedding model (about 35 MB) into `web/.cache/models`, which is gitignored.

Other commands, run in `web/`:

```sh
pnpm typecheck
pnpm test
pnpm build
```

Stop the dev server before building, then delete `web/.next` afterwards. A build running alongside `next dev` corrupts it.

## What's built

**Capture**
- Paste a URL on the library page and it saves at once.
- After saving, it prompts for a why-note.
- Pasting several links offers "Import all".
- The inline Import panel takes a file or pasted text.
- Bulk export is on the Settings page in JSON, CSV, HTML and TXT.

**Enrichment** (in the worker, using pg-boss)
- Fetches metadata, then readable text.
- Writes an extractive summary and keyword tags; no LLM is involved.
- Creates local embeddings with `Xenova/bge-small-en-v1.5`, 384-dimensional.

**Search**
- Hybrid search combines full-text and vector results with reciprocal rank fusion (`web/src/lib/search.ts`).
- Ctrl/Cmd+F opens it on the library page.

**Tiles** (`/tiles`)
- A WebGL grid built on OGL.
- Ctrl/Cmd+F opens a search overlay that flies to the matching tile.

**Explore** (`/explore`)
- "Bring back" shows rediscovery lists.
- Threads come from local clustering, rebuilt nightly or on demand.

**UI**
- Glass nav pill with an account menu (Profile, Settings, theme).
- Library sidebar, footer, and light and dark themes.
- Design tokens are in `web/src/app/globals.css`.

**Chrome extension** (`extension/`, v0.2.0)
- Saves through the popup, the right-click menu (page, link, or selection as the note) and Ctrl/Cmd+Shift+S.
- Authenticates with a bearer token created in Settings → Chrome extension.

See `docs/architecture.md` for more detail.

## Open items

1. **Test the extension in real Chrome.** Build it with `pnpm --filter extension build`, then load or reload `extension/dist` as an unpacked extension at `chrome://extensions`. The popup was only checked in a stubbed preview. The right-click menu, badge and selection-as-note haven't been tried in real Chrome.
2. **Reminders, notifications, widgets and mobile.** A plan is drafted and needs four decisions first:
   - **Hosting:** Oracle Cloud Always Free VM, or this PC behind a Cloudflare Tunnel. Web push needs a public HTTPS address.
   - **Reminder pace:** how often reminders go out by default.
   - **Native apps:** an Android Capacitor wrapper now, iOS once the Mac arrives in December. Store fees (Google Play $25, Apple $99/yr) only with explicit permission.
   - **Email digest:** whether to send one. It would use the free Resend tier and needs an account.

   Suggested order: mobile polish → hosting → web push reminders → Windows widget → Android → iOS.

## Ground rules

- **Free tier only.** Ask before anything paid.
- **Secrets:** never print secret values. Check keys by prefix or length only.
- **Ports:** ports 3000 and 3001 belong to another local project. Use port 3005 and don't kill those processes.
- **Supabase connections:** the session pooler allows 15 connections. On Windows, stop workers with `taskkill /T /F` on the whole process tree, or orphaned node processes keep holding connections.
- **Data access:** the server talks to Postgres directly, which bypasses RLS. Every query must filter by `user_id`.
- **Local config:** `.claude/launch.json` is local and stays uncommitted.
