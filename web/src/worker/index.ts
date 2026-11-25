/**
 * unfold worker: processes capture jobs from pg-boss.
 * Run: pnpm worker   (dev: pnpm worker:dev)
 *
 * Pipeline: metadata -> enrich (content extraction, summary + tags, embedding).
 * Separate queues so each step retries independently.
 */
import { PgBoss, type Job } from "pg-boss";
import { env } from "@/lib/env";
import { sql } from "@/lib/db";
import { fetchMetadata, PermanentFetchError } from "@/lib/metadata";
import { FetchBlockedError } from "@/lib/fetcher";
import { stalePendingIds } from "@/lib/discoveries";
import { QUEUES, type EnrichJob, type MetadataJob, type ThreadsJob } from "@/lib/queue";
import { buildThreads, usersWithEmbeddings } from "@/lib/threads/build";
import { ENRICH_RETRY_LIMIT, handleEnrich, unenrichedIds } from "./enrich";

const RETRY_LIMIT = 3;

let boss: PgBoss;

async function handleMetadata([job]: Job<MetadataJob>[]) {
  const { discoveryId } = job.data;
  const rows = await sql()<{ original_url: string }[]>`
    select original_url from discovery where id = ${discoveryId}`;
  if (!rows[0]) return; // deleted meanwhile

  try {
    const m = await fetchMetadata(rows[0].original_url);
    await sql()`
      update discovery set
        canonical_url = ${m.canonicalUrl},
        title         = coalesce(${m.title}, title),
        summary       = coalesce(summary, ${m.description}), -- replaced by AI summary in Phase 1
        resource_type = ${m.resourceType},
        domain        = ${m.domain},
        thumbnail_url = ${m.thumbnailUrl},
        favicon_url   = ${m.faviconUrl},
        status        = 'ready',
        error         = null
      where id = ${discoveryId}`;
    console.log(`[metadata] ready ${discoveryId} ${m.title ?? ""}`);
    await boss.send(QUEUES.enrich, { discoveryId } satisfies EnrichJob, { singletonKey: discoveryId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Partial records stay usable: on the final attempt mark failed, keep the URL.
    // Blocked URLs and 4xx responses won't fix themselves; don't retry them.
    const permanent = err instanceof FetchBlockedError || err instanceof PermanentFetchError;
    const final = permanent || job.retryCount >= RETRY_LIMIT;
    await sql()`
      update discovery set error = ${message.slice(0, 500)},
        status = ${final ? "failed" : "pending"}::discovery_status
      where id = ${discoveryId}`;
    console.warn(`[metadata] ${final ? "failed" : "retrying"} ${discoveryId}: ${message}`);
    if (!permanent) throw err;
  }
}

async function handleThreads([job]: Job<ThreadsJob>[]) {
  const users = job.data.userId ? [job.data.userId] : await usersWithEmbeddings();
  for (const userId of users) {
    const r = await buildThreads(userId, { force: job.data.force });
    console.log(
      r.skipped
        ? `[threads] ${userId}: unchanged, skipped`
        : `[threads] ${userId}: ${r.threads} threads from ${r.items} items (+${r.created} new, -${r.removed} removed)`,
    );
  }
}

async function main() {
  process.env.UNFOLD_WORKER = "1";
  boss = new PgBoss({ connectionString: env().DATABASE_URL, max: 5 });
  boss.on("error", (err) => console.error("[pg-boss]", err));
  await boss.start();

  await boss.createQueue(QUEUES.metadata, {
    policy: "stately",
    retryLimit: RETRY_LIMIT,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 60,
  });

  await boss.createQueue(QUEUES.enrich, {
    policy: "stately",
    retryLimit: ENRICH_RETRY_LIMIT,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 180,
  });

  await boss.createQueue(QUEUES.threads, { policy: "singleton", retryLimit: 1, expireInSeconds: 600 });
  // Nightly clustering; each user is skipped if their library hasn't changed.
  await boss.schedule(QUEUES.threads, process.env.THREADS_CRON ?? "0 3 * * *", {}, { tz: process.env.THREADS_TZ ?? "UTC" });

  await boss.work<MetadataJob>(QUEUES.metadata, { batchSize: 1, localConcurrency: 4 }, handleMetadata);
  // Embedding runs on this machine's CPU; two at a time keeps the worker light.
  await boss.work<EnrichJob>(QUEUES.enrich, { batchSize: 1, localConcurrency: 2 }, handleEnrich);
  await boss.work<ThreadsJob>(QUEUES.threads, { batchSize: 1 }, handleThreads);

  // Safety net: re-enqueue items stuck in `pending` (e.g. enqueue failed after insert).
  const sweep = async () => {
    try {
      for (const id of await stalePendingIds()) {
        await boss.send(QUEUES.metadata, { discoveryId: id }, { singletonKey: id });
      }
      // Backfill: ready items not yet enriched for a configured provider.
      for (const id of await unenrichedIds()) {
        await boss.send(QUEUES.enrich, { discoveryId: id } satisfies EnrichJob, { singletonKey: id });
      }
    } catch (err) {
      console.error("[sweep]", err);
    }
  };
  await sweep();
  const sweepTimer = setInterval(sweep, 5 * 60_000);

  console.log("[worker] started");

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal}, stopping`);
    clearInterval(sweepTimer);
    await boss.stop({ graceful: true, timeout: 20_000 });
    await sql().end({ timeout: 5 });
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
