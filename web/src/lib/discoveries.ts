import type postgres from "postgres";
import { sql } from "./db";
import { hashUrl } from "./url";

export type Discovery = {
  id: string;
  original_url: string;
  canonical_url: string | null;
  title: string | null;
  summary: string | null;
  why_note: string | null;
  resource_type: string | null;
  domain: string | null;
  thumbnail_url: string | null;
  favicon_url: string | null;
  tags: string[];
  status: "pending" | "ready" | "failed";
  saved_at: Date;
  last_opened_at: Date | null;
};

const COLUMNS = (db: postgres.Sql) => db`
  id, original_url, canonical_url, title, summary, why_note, resource_type,
  domain, thumbnail_url, favicon_url, tags, status, saved_at, last_opened_at`;

/**
 * Insert a discovery, or return the existing one for the same normalised URL.
 * A why-note on a re-save is kept if the existing record has none.
 */
export async function saveDiscovery(userId: string, url: URL, whyNote: string | null) {
  const db = sql();
  const rows = await db<(Discovery & { created: boolean })[]>`
    insert into discovery (user_id, original_url, url_hash, why_note, domain)
    values (${userId}, ${url.toString()}, ${hashUrl(url)}, ${whyNote},
            ${url.hostname.replace(/^www\./, "")})
    on conflict (user_id, url_hash) do update
      set why_note = coalesce(discovery.why_note, excluded.why_note)
    returning ${COLUMNS(db)}, (xmax = 0) as created`;
  return rows[0];
}

export async function listDiscoveries(userId: string, opts: { q?: string; limit?: number } = {}) {
  const db = sql();
  const limit = Math.min(opts.limit ?? 50, 200);
  const q = opts.q?.trim();
  if (!q) {
    return db<Discovery[]>`
      select ${COLUMNS(db)} from discovery
      where user_id = ${userId}
      order by saved_at desc limit ${limit}`;
  }
  // Phase 0: Postgres full-text. Phase 1 adds vector similarity + RRF.
  return db<Discovery[]>`
    with query as (select websearch_to_tsquery('english', ${q}) as tsq)
    select ${COLUMNS(db)} from discovery, query
    where user_id = ${userId}
      and (search_tsv @@ query.tsq
           or title ilike ${"%" + q + "%"}
           or original_url ilike ${"%" + q + "%"})
    order by ts_rank_cd(search_tsv, query.tsq) desc, saved_at desc
    limit ${limit}`;
}

export async function getDiscovery(userId: string, id: string) {
  const db = sql();
  const rows = await db<Discovery[]>`
    select ${COLUMNS(db)} from discovery where user_id = ${userId} and id = ${id}`;
  return rows[0] ?? null;
}

export async function markOpened(userId: string, id: string) {
  const rows = await sql()<{ original_url: string }[]>`
    update discovery set last_opened_at = now()
    where user_id = ${userId} and id = ${id}
    returning original_url`;
  return rows[0]?.original_url ?? null;
}

export async function updateWhyNote(userId: string, id: string, whyNote: string | null) {
  await sql()`update discovery set why_note = ${whyNote} where user_id = ${userId} and id = ${id}`;
}

export async function deleteDiscovery(userId: string, id: string) {
  await sql()`delete from discovery where user_id = ${userId} and id = ${id}`;
}

export async function deleteAllData(userId: string) {
  await sql().begin(async (tx) => {
    await tx`delete from discovery where user_id = ${userId}`;
    await tx`delete from api_token where user_id = ${userId}`;
  });
}

export async function exportAll(userId: string) {
  const db = sql();
  return db`
    select ${COLUMNS(db)} from discovery where user_id = ${userId} order by saved_at`;
}

/** Pending items the queue may have lost (e.g. enqueue failed after insert). */
export async function stalePendingIds(olderThanMinutes = 2) {
  const rows = await sql()<{ id: string }[]>`
    select id from discovery
    where status = 'pending' and saved_at < now() - make_interval(mins => ${olderThanMinutes})
    limit 500`;
  return rows.map((r) => r.id);
}
