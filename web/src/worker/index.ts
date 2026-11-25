/**
 * unfold worker: processes capture jobs from pg-boss.
 * Run: pnpm worker   (dev: pnpm worker:dev)
 *
 * Phase 0 pipeline: metadata only. Phase 1 adds `content` and `enrich` steps
 * as separate queues so each step retries independently.
 */
import { PgBoss, type Job } from "pg-boss";
import { env } from "@/lib/env";
import { sql } from "@/lib/db";
import { fetchMetadata, PermanentFetchError } from "@/lib/metadata";
import { FetchBlockedError } from "@/lib/fetcher";
import { stalePendingIds } from "@/lib/discoveries";
import { QUEUES, type MetadataJob } from "@/lib/queue";

const RETRY_LIMIT = 3;

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

async function main() {
  process.env.UNFOLD_WORKER = "1";
  const boss = new PgBoss({ connectionString: env().DATABASE_URL, max: 5 });
  boss.on("error", (err) => console.error("[pg-boss]", err));
  await boss.start();

  await boss.createQueue(QUEUES.metadata, {
    policy: "stately",
    retryLimit: RETRY_LIMIT,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 60,
  });

  await boss.work<MetadataJob>(QUEUES.metadata, { batchSize: 1, localConcurrency: 4 }, handleMetadata);

  // Safety net: re-enqueue items stuck in `pending` (e.g. enqueue failed after insert).
  const sweep = async () => {
    try {
      for (const id of await stalePendingIds()) {
        await boss.send(QUEUES.metadata, { discoveryId: id }, { singletonKey: id });
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
