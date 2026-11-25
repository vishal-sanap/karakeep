/**
 * Supabase public config, safe for client and server.
 * Accepts the newer publishable key (sb_publishable_...) or the legacy anon key.
 * Each variable is referenced literally so Next.js inlines it into the browser bundle.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
