import { sql } from "./db";

// Every query filters by user_id: the server connection bypasses RLS.

export async function libraryCount(userId: string): Promise<number> {
  const [r] = await sql()<{ n: number }[]>`select count(*)::int as n from discovery where user_id = ${userId}`;
  return r.n;
}

/** Tags that keep recurring in recent saves: the seed of a forming thread. */
export async function recurringTopics(userId: string, limit = 4): Promise<{ tag: string; n: number }[]> {
  return sql()<{ tag: string; n: number }[]>`
    select tag, count(*)::int as n
    from discovery, unnest(tags) as tag
    where user_id = ${userId} and saved_at > now() - interval '90 days'
    group by tag
    having count(*) >= 2
    order by n desc, tag
    limit ${limit}`;
}

export type RecentlyOpened = {
  id: string;
  title: string | null;
  domain: string | null;
  thumbnail_url: string | null;
  last_opened_at: Date;
};

export async function recentlyOpened(userId: string, limit = 3): Promise<RecentlyOpened[]> {
  return sql()<RecentlyOpened[]>`
    select id, title, domain, thumbnail_url, last_opened_at
    from discovery
    where user_id = ${userId} and last_opened_at is not null
    order by last_opened_at desc
    limit ${limit}`;
}

export async function profileStats(userId: string) {
  const [r] = await sql()<{ saved: number; noted: number; opened: number; threads: number; first: Date | null }[]>`
    select
      (select count(*)::int from discovery where user_id = ${userId}) as saved,
      (select count(*)::int from discovery where user_id = ${userId} and why_note is not null) as noted,
      (select count(*)::int from discovery where user_id = ${userId} and last_opened_at is not null) as opened,
      (select count(*)::int from thread where user_id = ${userId}) as threads,
      (select min(saved_at) from discovery where user_id = ${userId}) as first`;
  return r;
}
