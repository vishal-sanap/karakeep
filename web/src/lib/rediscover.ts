import type postgres from "postgres";
import { sql } from "./db";
import { RELATED_MAX_DISTANCE, type Discovery } from "./discoveries";

// Every query filters by user_id: the server connection bypasses RLS.

const D_COLUMNS = (db: postgres.Sql) => db`
  d.id, d.original_url, d.canonical_url, d.title, d.summary, d.why_note, d.resource_type,
  d.domain, d.thumbnail_url, d.favicon_url, d.tags, d.status, d.saved_at, d.last_opened_at, d.enriched_at`;

/** Saved more than `days` ago and never opened since. Oldest first. */
export async function unopened(userId: string, days = 14, limit = 5) {
  const db = sql();
  return db<Discovery[]>`
    select ${D_COLUMNS(db)} from discovery d
    where d.user_id = ${userId} and d.last_opened_at is null and d.status <> 'failed'
      and d.saved_at < now() - make_interval(days => ${days})
    order by d.saved_at asc
    limit ${limit}`;
}

export type Resurfaced = Discovery & { because_id: string; because_title: string | null; similarity: number };

/**
 * Older items (saved before this week, not opened in 30 days) closest to
 * something saved this week. One per older item.
 */
export async function relatedToThisWeek(userId: string, limit = 5) {
  const db = sql();
  return db<Resurfaced[]>`
    select distinct on (d.id) ${D_COLUMNS(db)},
      n.id as because_id, n.title as because_title, 1 - (d.embedding <=> n.embedding) as similarity
    from discovery n
    join discovery d
      on d.user_id = n.user_id and d.id <> n.id and d.embedding is not null
      and d.saved_at < now() - interval '7 days'
      and (d.last_opened_at is null or d.last_opened_at < now() - interval '30 days')
      and (d.embedding <=> n.embedding) <= ${RELATED_MAX_DISTANCE}
    where n.user_id = ${userId} and n.embedding is not null and n.saved_at >= now() - interval '7 days'
    order by d.id, d.embedding <=> n.embedding
    limit ${limit * 4}`.then((rows) => rows.sort((a, b) => b.similarity - a.similarity).slice(0, limit));
}

export type ThreadOldest = Discovery & { thread_id: string; thread_name: string };

/** For threads that gained an item this week: their oldest member from before that. */
export async function oldestInActiveThreads(userId: string, limit = 5) {
  const db = sql();
  return db<ThreadOldest[]>`
    select distinct on (t.id) ${D_COLUMNS(db)}, t.id as thread_id, t.name as thread_name
    from thread t
    join thread_member m on m.thread_id = t.id
    join discovery d on d.id = m.discovery_id
    where t.user_id = ${userId}
      and exists (
        select 1 from thread_member m2 join discovery n on n.id = m2.discovery_id
        where m2.thread_id = t.id and n.saved_at >= now() - interval '7 days'
      )
      and d.saved_at < now() - interval '7 days'
    order by t.id, d.saved_at asc
    limit ${limit}`;
}

/**
 * One gentle reason to revisit something, for the top of the library:
 * an older item related to this week's saves, else the oldest never-opened one.
 */
export async function exploreNudge(userId: string): Promise<{ id: string; title: string | null; domain: string | null; reason: string } | null> {
  const [related] = await relatedToThisWeek(userId, 1);
  if (related) {
    return {
      id: related.id,
      title: related.title,
      domain: related.domain,
      reason: `Related to something you saved this week, from ${weeksAgo(related.saved_at)}:`,
    };
  }
  const [old] = await unopened(userId, 14, 1);
  if (old) return { id: old.id, title: old.title, domain: old.domain, reason: `You saved this ${weeksAgo(old.saved_at)} and haven't opened it yet:` };
  return null;
}

function weeksAgo(d: Date | string) {
  const w = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / (7 * 86_400_000)));
  return w === 1 ? "a week ago" : `${w} weeks ago`;
}
