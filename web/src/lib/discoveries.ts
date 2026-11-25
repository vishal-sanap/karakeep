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
  enriched_at: Date | null;
};

// Never select `embedding` in list queries: 1024 floats per row.
const COLUMNS = (db: postgres.Sql) => db`
  id, original_url, canonical_url, title, summary, why_note, resource_type,
  domain, thumbnail_url, favicon_url, tags, status, saved_at, last_opened_at, enriched_at`;
const D_COLUMNS = (db: postgres.Sql) => db`
  d.id, d.original_url, d.canonical_url, d.title, d.summary, d.why_note, d.resource_type,
  d.domain, d.thumbnail_url, d.favicon_url, d.tags, d.status, d.saved_at, d.last_opened_at, d.enriched_at`;

/**
 * Cosine-distance cut-offs (distance = 1 - similarity), bge-small-en-v1.5.
 * Calibrated on a small library (Nov 2026); revisit at ~20+ items:
 * - query -> correct item scored 0.61-0.77; off-topic queries topped out at 0.57.
 * - unrelated item pairs scored 0.45-0.55; a genuinely related pair 0.60.
 */
const SEARCH_MAX_DISTANCE = 0.42; // vector-only hits need similarity >= 0.58
export const RELATED_MAX_DISTANCE = 0.38; // "related" (and thread linkage) needs similarity >= 0.62
const RRF_K = 60;

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

export async function listDiscoveries(
  userId: string,
  opts: { q?: string; limit?: number; queryEmbedding?: string | null } = {},
) {
  const db = sql();
  const limit = Math.min(opts.limit ?? 50, 200);
  const q = opts.q?.trim();
  if (!q) {
    return db<Discovery[]>`
      select ${COLUMNS(db)} from discovery
      where user_id = ${userId}
      order by saved_at desc limit ${limit}`;
  }
  // Escape LIKE wildcards so "100%" or "snake_case" match literally.
  const like = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
  const fts = db`
    select id, row_number() over (order by ts_rank_cd(search_tsv, tsq) desc, saved_at desc) as r
    from discovery, websearch_to_tsquery('english', ${q}) as tsq
    where user_id = ${userId}
      and (search_tsv @@ tsq or title ilike ${like} or original_url ilike ${like})
    limit 50`;

  if (!opts.queryEmbedding) {
    // Full-text only (no embedding provider, or the query embedding failed).
    return db<Discovery[]>`
      with fts as (${fts})
      select ${D_COLUMNS(db)} from fts join discovery d on d.id = fts.id
      order by fts.r limit ${limit}`;
  }

  // Hybrid: reciprocal rank fusion of full-text rank and vector similarity.
  return db<Discovery[]>`
    with fts as (${fts}),
    vec as (
      select id, row_number() over (order by dist) as r
      from (
        select id, embedding <=> ${opts.queryEmbedding}::vector as dist
        from discovery
        where user_id = ${userId} and embedding is not null
        order by dist
        limit 50
      ) nn
      where dist <= ${SEARCH_MAX_DISTANCE}
    )
    select ${D_COLUMNS(db)}
    from discovery d
    left join fts on fts.id = d.id
    left join vec on vec.id = d.id
    where d.user_id = ${userId} and (fts.id is not null or vec.id is not null)
    order by coalesce(1.0 / (${RRF_K} + fts.r), 0) + coalesce(1.0 / (${RRF_K} + vec.r), 0) desc,
             d.saved_at desc
    limit ${limit}`;
}

export type RelatedItem = Discovery & { similarity: number };

/** Nearest neighbours above the similarity floor, minus dismissed pairs. Computed on view. */
export async function relatedDiscoveries(userId: string, id: string, k = 6) {
  const db = sql();
  return db<RelatedItem[]>`
    select ${D_COLUMNS(db)}, 1 - nn.dist as similarity
    from (
      select d.id, d.embedding <=> src.embedding as dist
      from discovery src
      join discovery d on d.user_id = src.user_id and d.id <> src.id and d.embedding is not null
      where src.id = ${id} and src.user_id = ${userId} and src.embedding is not null
      order by dist
      limit ${k * 3}
    ) nn
    join discovery d on d.id = nn.id
    left join relation r on r.a_id = least(${id}::uuid, d.id) and r.b_id = greatest(${id}::uuid, d.id)
    where nn.dist <= ${RELATED_MAX_DISTANCE} and not coalesce(r.dismissed, false)
    order by nn.dist
    limit ${k}`;
}

const pair = (x: string, y: string) => (x < y ? [x, y] : [y, x]);

/** Both discoveries, only if both belong to the user. */
export async function getPair(userId: string, id: string, otherId: string) {
  const db = sql();
  const rows = await db<(Discovery & { similarity: number | null })[]>`
    select ${D_COLUMNS(db)},
      (select 1 - (a.embedding <=> b.embedding) from discovery a, discovery b
        where a.id = ${id} and b.id = ${otherId}) as similarity
    from discovery d
    where d.user_id = ${userId} and d.id in (${id}, ${otherId})`;
  const a = rows.find((r) => r.id === id);
  const b = rows.find((r) => r.id === otherId);
  return a && b ? { a, b, similarity: a.similarity } : null;
}

/** Dismissed pairs are never suggested again. Caller must verify ownership (getPair). */
export async function dismissRelation(userId: string, id: string, otherId: string) {
  const [a, b] = pair(id, otherId);
  await sql()`
    insert into relation (user_id, a_id, b_id, dismissed)
    values (${userId}, ${a}, ${b}, true)
    on conflict (a_id, b_id) do update set dismissed = true, updated_at = now()
    where relation.user_id = ${userId}`;
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

/** Returns false if no such discovery for this user. */
export async function updateWhyNote(userId: string, id: string, whyNote: string | null) {
  const res = await sql()`update discovery set why_note = ${whyNote} where user_id = ${userId} and id = ${id}`;
  return res.count > 0;
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
