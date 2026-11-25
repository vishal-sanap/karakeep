import { aiConfig } from "./env";
import { embedQuery, toPgVector } from "./ai/embeddings";
import { listDiscoveries } from "./discoveries";

/**
 * Library search: hybrid (full-text + vector, fused by RRF) when embeddings
 * are configured; full-text only otherwise or if the query embedding fails.
 * `degraded` is true when embeddings are configured but the query embedding
 * failed (e.g. a provider rate limit), so callers can say so.
 */
export async function searchDiscoveries(userId: string, q?: string, limit?: number) {
  const query = q?.trim();
  let queryEmbedding: string | null = null;
  let degraded = false;
  if (query && aiConfig().embed) {
    try {
      queryEmbedding = toPgVector(await embedQuery(query.slice(0, 1000)));
    } catch (err) {
      degraded = true;
      console.warn("[search] query embedding failed, using full-text only:", err instanceof Error ? err.message.slice(0, 120) : err);
    }
  }
  const items = await listDiscoveries(userId, { q: query, limit, queryEmbedding });
  return { items, degraded };
}
