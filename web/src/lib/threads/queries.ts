import type postgres from "postgres";
import { sql } from "../db";
import type { Discovery } from "../discoveries";

// Every query filters by user_id: the server connection bypasses RLS.

const D_COLUMNS = (db: postgres.Sql) => db`
  d.id, d.original_url, d.canonical_url, d.title, d.summary, d.why_note, d.resource_type,
  d.domain, d.thumbnail_url, d.favicon_url, d.tags, d.status, d.saved_at, d.last_opened_at, d.enriched_at`;

export type ThreadSummary = {
  id: string;
  name: string;
  size: number;
  updated_at: Date;
  last_added: Date | null;
  sample: { id: string; title: string | null; favicon_url: string | null }[];
};

/** Threads, most recently grown first, each with a few sample items. */
export async function listThreads(userId: string): Promise<ThreadSummary[]> {
  return sql()<ThreadSummary[]>`
    select t.id, t.name, t.size, t.updated_at,
      (select max(d.saved_at) from thread_member m join discovery d on d.id = m.discovery_id where m.thread_id = t.id) as last_added,
      coalesce((
        select json_agg(json_build_object('id', s.id, 'title', s.title, 'favicon_url', s.favicon_url))
        from (
          select d.id, d.title, d.favicon_url from thread_member m join discovery d on d.id = m.discovery_id
          where m.thread_id = t.id and m.is_primary order by m.score desc limit 3
        ) s
      ), '[]') as sample
    from thread t
    where t.user_id = ${userId}
    order by last_added desc nulls last, t.size desc`;
}

export async function getThread(userId: string, id: string) {
  const db = sql();
  const [thread] = await db<{ id: string; name: string; size: number; updated_at: Date }[]>`
    select id, name, size, updated_at from thread where id = ${id} and user_id = ${userId}`;
  if (!thread) return null;
  const members = await db<(Discovery & { score: number; is_primary: boolean })[]>`
    select ${D_COLUMNS(db)}, m.score, m.is_primary
    from thread_member m join discovery d on d.id = m.discovery_id
    where m.thread_id = ${id} and d.user_id = ${userId}
    order by m.is_primary desc, d.saved_at desc`;
  return { thread, members };
}

/** Threads a discovery belongs to (for its detail page). */
export async function threadsForDiscovery(userId: string, discoveryId: string) {
  return sql()<{ id: string; name: string; size: number }[]>`
    select t.id, t.name, t.size
    from thread_member m join thread t on t.id = m.thread_id
    where m.discovery_id = ${discoveryId} and t.user_id = ${userId}
    order by m.is_primary desc, m.score desc`;
}

export async function lastThreadBuild(userId: string) {
  const [row] = await sql()<{ built_at: Date; item_count: number }[]>`
    select built_at, item_count from thread_build where user_id = ${userId}`;
  return row ?? null;
}
