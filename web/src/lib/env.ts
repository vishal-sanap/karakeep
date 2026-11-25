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

