import { embedQuery, toPgVector } from "./ai/embeddings";
import { listDiscoveries } from "./discoveries";

/**
 * Library search: hybrid (full-text + local vector similarity, fused by RRF).
 * Falls back to full-text only if the query embedding fails; `degraded` says so.
 */
export async function searchDiscoveries(userId: string, q?: string, limit?: number) {
  const query = q?.trim();
  let queryEmbedding: string | null = null;
  let degraded = false;
  if (query) {
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
