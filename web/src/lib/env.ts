import { z } from "zod";

/**
 * Server-side environment. Parsed lazily so `next build` works without secrets.
 * Never import this from client components.
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  YOUTUBE_API_KEY: z.string().optional(),
  FETCH_USER_AGENT: z.string().default("unfold/0.1 (+personal library fetcher)"),
});

let cached: z.infer<typeof schema> | undefined;

export function env() {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
