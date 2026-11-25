import { createHash } from "node:crypto";
import { sql } from "../db";
import { RELATED_MAX_DISTANCE } from "../discoveries";
import { EMBEDDING_MODEL, toPgVector } from "../ai/embeddings";
import { nameCluster } from "../keywords";
import { agglomerate, centroid, dot, matchClusters } from "./cluster";

/** Threads need at least this many items; smaller groups are just "related". */
export const MIN_THREAD_SIZE = 3;
/** Average-linkage cut-off: the same floor as "related". */
export const LINK_MIN_SIM = 1 - RELATED_MAX_DISTANCE;
/** An item also joins another thread if this close to its centroid. */
export const SECONDARY_MIN_SIM = 0.7;
/** Below this member overlap a matched thread is renamed. */
const KEEP_NAME_OVERLAP = 0.5;

type Item = { id: string; title: string | null; tags: string[]; vec: number[] };

export type BuildResult = { skipped: boolean; items: number; threads: number; created: number; removed: number };

/**
 * (Re)build one user's threads. Skips when nothing changed since the last
 * build unless `force`. Thread ids, and each member's `added_at`, survive
 * rebuilds when the cluster mostly persists.
 */
export async function buildThreads(userId: string, opts: { force?: boolean } = {}): Promise<BuildResult> {
  const db = sql();
  const rows = await db<{ id: string; title: string | null; tags: string[]; emb: string; enriched_at: Date }[]>`
    select id, title, tags, embedding::text as emb, enriched_at
    from discovery
    where user_id = ${userId} and embedding is not null and embedding_model = ${EMBEDDING_MODEL}
    order by id`;

  const fingerprint = createHash("sha256")
    .update(EMBEDDING_MODEL)
    .update(rows.map((r) => `${r.id}:${r.enriched_at.getTime()}`).join(","))
    .digest("hex");
  if (!opts.force) {
    const prev = await db<{ fingerprint: string | null }[]>`select fingerprint from thread_build where user_id = ${userId}`;
    if (prev[0]?.fingerprint === fingerprint) return { skipped: true, items: rows.length, threads: 0, created: 0, removed: 0 };
  }

  const items: Item[] = rows.map((r) => ({ id: r.id, title: r.title, tags: r.tags, vec: JSON.parse(r.emb) as number[] }));
  const groups = agglomerate(
    items.map((i) => i.vec),
    LINK_MIN_SIM,
  )
    .filter((g) => g.length >= MIN_THREAD_SIZE)
    .map((g) => g.map((i) => items[i]));

  const clusters = groups.map((members) => {
    const c = centroid(members.map((m) => m.vec));
    const primary = new Set(members.map((m) => m.id));
    // Strong secondary members from outside the cluster.
    const secondary = items.filter((it) => !primary.has(it.id) && dot(it.vec, c) >= SECONDARY_MIN_SIM);
    return { members, secondary, centroid: c };
  });
  const names = clusters.map((c) => nameCluster(c.members, clusters.map((x) => x.members)));

  const previous = await db<{ id: string; name: string; members: string[] }[]>`
    select t.id, t.name, coalesce(array_agg(m.discovery_id::text) filter (where m.is_primary), '{}') as members
    from thread t left join thread_member m on m.thread_id = t.id
    where t.user_id = ${userId}
    group by t.id`;
  const matches = matchClusters(
    clusters.map((c) => c.members.map((m) => m.id)),
    previous,
  );
  const addedAt = new Map(
    (
      await db<{ thread_id: string; discovery_id: string; added_at: Date }[]>`
        select m.thread_id, m.discovery_id, m.added_at
        from thread_member m join thread t on t.id = m.thread_id
        where t.user_id = ${userId}`
    ).map((r) => [`${r.thread_id}:${r.discovery_id}`, r.added_at]),
  );

  let created = 0;
  await db.begin(async (tx) => {
    const keep = new Set<string>();
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      const match = matches[i];
      const prevName = match ? previous.find((p) => p.id === match.id)?.name : undefined;
      const name = match && match.overlap >= KEEP_NAME_OVERLAP && prevName ? prevName : names[i];
      const size = c.members.length + c.secondary.length;
      let threadId: string;
      if (match) {
        threadId = match.id;
        await tx`
          update thread set name = ${name}, centroid = ${toPgVector(c.centroid)}::vector, size = ${size}, updated_at = now()
          where id = ${threadId}`;
      } else {
        const [t] = await tx<{ id: string }[]>`
          insert into thread (user_id, name, centroid, size)
          values (${userId}, ${name}, ${toPgVector(c.centroid)}::vector, ${size})
          returning id`;
        threadId = t.id;
        created++;
      }
      keep.add(threadId);

      await tx`delete from thread_member where thread_id = ${threadId}`;
      const memberRows = [
        ...c.members.map((m) => ({ m, primary: true })),
        ...c.secondary.map((m) => ({ m, primary: false })),
      ].map(({ m, primary }) => ({
        thread_id: threadId,
        discovery_id: m.id,
        score: dot(m.vec, c.centroid),
        is_primary: primary,
        added_at: addedAt.get(`${threadId}:${m.id}`) ?? new Date(),
      }));
      await tx`insert into thread_member ${tx(memberRows, "thread_id", "discovery_id", "score", "is_primary", "added_at")}`;
    }
    const stale = previous.map((p) => p.id).filter((id) => !keep.has(id));
    if (stale.length) await tx`delete from thread where user_id = ${userId} and id in ${tx(stale)}`;
    await tx`
      insert into thread_build (user_id, built_at, item_count, fingerprint)
      values (${userId}, now(), ${items.length}, ${fingerprint})
      on conflict (user_id) do update
        set built_at = now(), item_count = excluded.item_count, fingerprint = excluded.fingerprint`;
  });

  const removed = previous.filter((p) => !matches.some((m) => m?.id === p.id)).length;
  return { skipped: false, items: items.length, threads: clusters.length, created, removed };
}

/** Users with at least one embedded item: candidates for the nightly build. */
export async function usersWithEmbeddings(): Promise<string[]> {
  const rows = await sql()<{ user_id: string }[]>`
    select distinct user_id from discovery where embedding is not null`;
  return rows.map((r) => r.user_id);
}
