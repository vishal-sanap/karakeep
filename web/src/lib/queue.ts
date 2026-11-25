import { PgBoss } from "pg-boss";
import { env } from "./env";

export const QUEUES = {
  metadata: "discovery-metadata",
} as const;

export type MetadataJob = { discoveryId: string };

declare global {
  var __unfoldBoss: Promise<PgBoss> | undefined;
}

/**
 * pg-boss client for the *web app*: send-only. No supervision, scheduling or
 * migrations; the worker owns those (run the worker once before saving).
 */
export function senderBoss(): Promise<PgBoss> {
  if (!globalThis.__unfoldBoss) {
    const boss = new PgBoss({
      connectionString: env().DATABASE_URL,
      supervise: false,
      schedule: false,
      migrate: false,
      max: 2,
    });
    boss.on("error", (err) => console.error("[pg-boss]", err));
    globalThis.__unfoldBoss = boss.start().then(() => boss).catch((err) => {
      globalThis.__unfoldBoss = undefined;
      throw err;
    });
  }
  return globalThis.__unfoldBoss;
}

export async function enqueueMetadata(discoveryId: string) {
  const boss = await senderBoss();
  await boss.send(QUEUES.metadata, { discoveryId } satisfies MetadataJob, {
    singletonKey: discoveryId,
  });
}
