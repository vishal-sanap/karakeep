import type { Job } from "pg-boss";
import { sql } from "@/lib/db";
import { aiConfig } from "@/lib/env";
import { fetchContent, type PageContent } from "@/lib/extract";
import { RefusalError, summarizeAndTag } from "@/lib/ai/claude";
import { EMBEDDING_MODEL, embed, embeddingText, toPgVector } from "@/lib/ai/embeddings";
import type { EnrichJob } from "@/lib/queue";

export const ENRICH_RETRY_LIMIT = 3;

type Row = {
  original_url: string;
  title: string | null;
  summary: string | null;
  why_note: string | null;
  domain: string | null;
  tags: string[];
  enriched_at: Date | null;
};

/**
 * Phase 1 enrichment for one discovery:
 *   1. content: re-fetch the page and extract main text (never stored)
 *   2. summarise: one Claude call -> summary + tags
 *   3. embed: title + summary + tags + why-note -> Voyage vector
 * Steps degrade independently; partial records stay usable.
 */
export async function handleEnrich([job]: Job<EnrichJob>[]) {
  const { discoveryId, embedOnly } = job.data;
  const ai = aiConfig();
  const rows = await sql()<Row[]>`
    select original_url, title, summary, why_note, domain, tags, enriched_at
    from discovery where id = ${discoveryId}`;
  const d = rows[0];
  if (!d) return; // deleted meanwhile

  const errors: string[] = [];
  const final = job.retryCount >= ENRICH_RETRY_LIMIT;

  // 1 + 2: content and summary (skipped for embed-only refreshes)
  // Skip when already summarised (e.g. a retry after only the embedding failed).
  if (!embedOnly && ai.summarize && !d.enriched_at) {
    let content: PageContent = { description: null, text: null };
    try {
      content = await fetchContent(d.original_url);
    } catch (err) {
      // Summarise from title + stored description instead.
      console.warn(`[enrich] content unavailable ${discoveryId}: ${msg(err)}`);
    }
    try {
      const out = await summarizeAndTag({
        url: d.original_url,
        title: d.title,
        description: content.description ?? d.summary,
        text: content.text,
        whyNote: d.why_note,
      });
      await sql()`
        update discovery set summary = ${out.summary}, tags = ${out.tags},
          enriched_at = now(), enrich_error = null
        where id = ${discoveryId}`;
      d.summary = out.summary;
      d.tags = out.tags;
    } catch (err) {
      // Retry transient failures; the singleton key stops the sweep duplicating the job.
      if (!(err instanceof RefusalError) && !final) throw err;
      errors.push(`summary: ${msg(err)}`);
    }
  }

  // 3: embedding (runs even if summarising failed, from whatever we have)
  if (ai.embed) {
    try {
      const [vec] = await embed([embeddingText(d)], "document");
      await sql()`
        update discovery set embedding = ${toPgVector(vec)}::vector, embedding_model = ${EMBEDDING_MODEL}
        where id = ${discoveryId}`;
    } catch (err) {
      if (!final) throw err;
      errors.push(`embedding: ${msg(err)}`);
    }
  }

  // Terminal failures are recorded (stops the sweep re-queuing this item);
  // success clears any error left by an earlier attempt.
  await recordError(discoveryId, errors.length ? errors.join("; ") : null);
  console.log(
    `[enrich] ${errors.length ? "partial" : "done"} ${discoveryId}${embedOnly ? " (embed only)" : ""}${errors.length ? `: ${errors.join("; ")}` : ""}`,
  );
}

async function recordError(id: string, error: string | null) {
  await sql()`update discovery set enrich_error = ${error?.slice(0, 500) ?? null} where id = ${id}`;
}

const msg = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Ready items that still need enrichment for a configured provider, and have
 * no recorded terminal error. Used by the sweep for backfill and lost jobs.
 */
export async function unenrichedIds(limit = 200): Promise<string[]> {
  const ai = aiConfig();
  if (!ai.summarize && !ai.embed) return [];
  const rows = await sql()<{ id: string }[]>`
    select id from discovery
    where status = 'ready' and enrich_error is null
      and (${ai.summarize}::boolean and enriched_at is null
           or ${ai.embed}::boolean and embedding is null)
      and saved_at < now() - interval '2 minutes'
    order by saved_at desc
    limit ${limit}`;
  return rows.map((r) => r.id);
}
