import path from "node:path";
import { env as hfEnv, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

/**
 * Local embeddings: bge-small-en-v1.5 (quantized ONNX, ~35 MB) running on CPU
 * via transformers.js. No API, no key, no rate limit. Downloaded once from
 * Hugging Face into web/.cache/models, then fully offline.
 *
 * The model and dimension are pinned by the database column (vector(384));
 * changing either needs a migration + re-embed.
 */
export const EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5";
export const EMBEDDING_DIM = 384;

// bge retrieval: queries get this instruction prefix, documents don't.
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

hfEnv.cacheDir = process.env.MODEL_CACHE_DIR ?? path.join(process.cwd(), ".cache", "models");

declare global {
  var __unfoldEmbedder: Promise<FeatureExtractionPipeline> | undefined;
}

/** Loaded lazily, once per process (survives Next dev hot reloads). */
function embedder(): Promise<FeatureExtractionPipeline> {
  globalThis.__unfoldEmbedder ??= pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "q8" }).catch((err) => {
    globalThis.__unfoldEmbedder = undefined;
    throw err;
  }) as Promise<FeatureExtractionPipeline>;
  return globalThis.__unfoldEmbedder;
}

export async function embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = await embedder();
  const input = inputType === "query" ? texts.map((t) => QUERY_PREFIX + t) : texts;
  // bge uses the [CLS] token embedding; normalised so cosine == dot product.
  const out = await model(input, { pooling: "cls", normalize: true });
  const vectors = out.tolist() as number[][];
  if (vectors.some((v) => v.length !== EMBEDDING_DIM)) throw new Error("Unexpected embedding size");
  return vectors;
}

export async function embedQuery(text: string): Promise<number[]> {
  return (await embed([text], "query"))[0];
}

/** pgvector text form, e.g. "[0.1,0.2]". Pass as a parameter and cast with ::vector. */
export const toPgVector = (v: number[]) => `[${v.join(",")}]`;

/** Characters of page text added to the embedding input (not stored). The model reads ~512 tokens. */
export const EMBED_BODY_CHARS = 1500;

/** What gets embedded for a discovery: everything the user might later describe it by. */
export function embeddingText(d: {
  title: string | null;
  summary: string | null;
  tags: string[];
  why_note: string | null;
  domain: string | null;
  original_url: string;
  body?: string | null;
}): string {
  return [
    d.title ?? d.original_url,
    d.why_note ? `Why I saved it: ${d.why_note}` : null,
    d.summary,
    d.tags.length ? `Topics: ${d.tags.join(", ")}` : null,
    d.domain ? `Source: ${d.domain}` : null,
    d.body ? d.body.slice(0, EMBED_BODY_CHARS) : null,
  ]
    .filter(Boolean)
    .join("\n");
}
