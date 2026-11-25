import { env } from "../env";

/**
 * Embeddings via Voyage AI. The model and dimension are pinned by the
 * database column (vector(1024)); changing either needs a migration + re-embed.
 */
export const EMBEDDING_MODEL = "voyage-3.5-lite";
export const EMBEDDING_DIM = 1024;

export class EmbeddingsDisabledError extends Error {}

type VoyageResponse = { data: { embedding: number[]; index: number }[] };

/** `document` for library items, `query` for search text (Voyage tunes each). */
export async function embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
  const key = env().VOYAGE_API_KEY;
  if (!key) throw new EmbeddingsDisabledError("VOYAGE_API_KEY is not set");
  if (texts.length === 0) return [];

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      input: texts,
      model: EMBEDDING_MODEL,
      input_type: inputType,
      output_dimension: EMBEDDING_DIM,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`Voyage ${res.status}: ${detail}`);
  }
  const body = (await res.json()) as VoyageResponse;
  const out: number[][] = new Array(texts.length);
  for (const d of body.data) out[d.index] = d.embedding;
  if (out.some((v) => !v || v.length !== EMBEDDING_DIM)) throw new Error("Voyage returned unexpected embeddings");
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  return (await embed([text], "query"))[0];
}

/** pgvector text form, e.g. "[0.1,0.2]". Pass as a parameter and cast with ::vector. */
export const toPgVector = (v: number[]) => `[${v.join(",")}]`;

/** What gets embedded for a discovery: everything the user might later describe it by. */
export function embeddingText(d: {
  title: string | null;
  summary: string | null;
  tags: string[];
  why_note: string | null;
  domain: string | null;
  original_url: string;
}): string {
  return [
    d.title ?? d.original_url,
    d.summary,
    d.tags.length ? `Topics: ${d.tags.join(", ")}` : null,
    d.why_note ? `Why I saved it: ${d.why_note}` : null,
    d.domain ? `Source: ${d.domain}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
