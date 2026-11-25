import postgres from "postgres";
import { env } from "./env";

declare global {
  var __unfoldSql: postgres.Sql | undefined;
}

/**
 * Direct Postgres connection (bypasses RLS). Every query touching user data
 * MUST filter by user_id; keep those queries in `discoveries.ts` / `tokens.ts`.
 *
 * Use the Supabase *session* pooler or direct connection (port 5432).
 * `prepare: false` keeps it compatible with the transaction pooler too.
 */
export function sql(): postgres.Sql {
  if (!globalThis.__unfoldSql) {
    globalThis.__unfoldSql = postgres(env().DATABASE_URL, {
      prepare: false,
      max: process.env.UNFOLD_WORKER ? 5 : 3,
      idle_timeout: 20,
    });
  }
  return globalThis.__unfoldSql;
}
