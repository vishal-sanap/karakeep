import type { Job } from "pg-boss";
import { sql } from "@/lib/db";
import { fetchContent, type PageContent } from "@/lib/extract";
import { extractSummary, extractTags, titleCore, tokenize } from "@/lib/keywords";
import { EMBEDDING_MODEL, embed, embeddingText, toPgVector } from "@/lib/ai/embeddings";
import type { EnrichJob } from "@/lib/queue";

export const ENRICH_RETRY_LIMIT = 3;

type Row = {
  user_id: string;
  original_url: string;
  title: string | null;
  summary: string | null;
  why_note: string | null;
  domain: string | null;
  tags: string[];
};

/**
 * Enrichment for one discovery, all local (no API, no key):
 *   1. content: re-fetch the page, extract main text (never stored)
 *   2. summary + tags: extractive summary, keyword tags scored against the library
 *   3. embed: local bge-small over title, why-note, summary, tags and the start of the text
 * If the page can't be fetched, the existing summary/tags are kept and the
 * embedding is built from stored fields only. Also re-run after why-note edits.
 */
export async function handleEnrich([job]: Job<EnrichJob>[]) {
  const { discoveryId } = job.data;
  const rows = await sql()<Row[]>`
    select user_id, original_url, title, summary, why_note, domain, tags
    from discovery where id = ${discoveryId}`;
  const d = rows[0];
  if (!d) return; // deleted meanwhile

  let content: PageContent | null = null;
  try {
    content = await fetchContent(d.original_url);
  } catch (err) {
    console.warn(`[enrich] content unavailable ${discoveryId}: ${msg(err)}`);
  }

  try {
    if (content) {
      // Only the page's own description: feeding back our stored summary would
      // double-count its phrases on every re-run.
      const summary = extractSummary(content.description, content.text) ?? d.summary;
      const docFreq = await libraryDocFreq(d.user_id, discoveryId);
      const tags = extractTags({ title: d.title, description: content.description, body: content.text }, { docFreq });
      d.summary = summary;
      if (tags.length) d.tags = tags;
    }
    const [vec] = await embed([embeddingText({ ...d, body: content?.text })], "document");
    await sql()`
      update discovery set
        summary = ${d.summary}, tags = ${d.tags},
        embedding = ${toPgVector(vec)}::vector, embedding_model = ${EMBEDDING_MODEL},
        enriched_at = now(), enrich_error = null
      where id = ${discoveryId}`;
    console.log(`[enrich] done ${discoveryId}${content ? "" : " (from stored fields)"} tags=[${d.tags.join(", ")}]`);
  } catch (err) {
    if (job.retryCount < ENRICH_RETRY_LIMIT) throw err;
    // Terminal: record it so the sweep stops re-queuing this item.
    await sql()`update discovery set enrich_error = ${msg(err).slice(0, 500)} where id = ${discoveryId}`;
    console.warn(`[enrich] failed ${discoveryId}: ${msg(err)}`);
  }
}

/**
 * Share of the user's library whose title/summary/tags contain a term. Lets
 * tag extraction skip words that are everywhere in *this* library.
 */
async function libraryDocFreq(userId: string, excludeId: string): Promise<((term: string) => number) | undefined> {
  const rows = await sql()<{ title: string | null; summary: string | null; tags: string[] }[]>`
    select title, summary, tags from discovery
    where user_id = ${userId} and id <> ${excludeId}
    order by saved_at desc limit 2000`;
  if (rows.length < 5) return undefined; // too small to say what's "common"
  const df = new Map<string, number>();
  for (const r of rows) {
    const terms = new Set([...tokenize(`${titleCore(r.title) ?? ""} ${r.summary ?? ""}`), ...r.tags]);
    for (const t of terms) df.set(t, (df.get(t) ?? 0) + 1);
  }
  // A bigram is as common as its rarer word.
  return (term) => Math.min(...term.split(" ").map((p) => (df.get(p) ?? 0) / rows.length));
}

const msg = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Ready items that still need enrichment (never enriched, or embedded with a
 * different model) and have no recorded terminal error. Used by the sweep for
 * backfill and lost jobs.
 */
export async function unenrichedIds(limit = 200): Promise<string[]> {
  const rows = await sql()<{ id: string }[]>`
    select id from discovery
    where status = 'ready' and enrich_error is null
      and (enriched_at is null or embedding is null or embedding_model is distinct from ${EMBEDDING_MODEL})
      and saved_at < now() - interval '2 minutes'
    order by saved_at desc
    limit ${limit}`;
  return rows.map((r) => r.id);
}
