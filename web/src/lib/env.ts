import { z } from "zod";

/**
 * Server-side environment. Parsed lazily so `next build` works without secrets.
 * Never import this from client components.
 */
/** Treats an empty value (`KEY=` in a .env file) as unset. */
const optionalKey = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

const schema = z
  .object({
    DATABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
    YOUTUBE_API_KEY: optionalKey,
    // Phase 1 AI. Each is optional: without it that step is skipped and items
    // stay usable with metadata only (search falls back to full-text).
    ANTHROPIC_API_KEY: optionalKey,
    VOYAGE_API_KEY: optionalKey,
    ENRICH_MODEL: z.string().default("claude-opus-5-5"),
    FETCH_USER_AGENT: z
      .string()
      .default("unfold/0.1 (+personal library fetcher)"),
  })
  .refine(
    (e) =>
      e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || e.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      message:
        "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    },
  );

let cached: z.infer<typeof schema> | undefined;

export function env() {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

/** Which Phase 1 AI steps are configured. */
export function aiConfig() {
  const e = env();
  return { summarize: Boolean(e.ANTHROPIC_API_KEY), embed: Boolean(e.VOYAGE_API_KEY) };
}
