import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { safeFetch } from "./fetcher";
import { fetchMetadata, parseHtmlMetadata } from "./metadata";
import { parseHttpUrl, youtubeVideoId } from "./url";

/** ~3k tokens: plenty for a 2-sentence summary, keeps each enrich call cheap. */
export const MAX_CONTENT_CHARS = 12_000;

export type PageContent = {
  /** Page-supplied description (og:description etc.), if any. */
  description: string | null;
  /** Main readable text, whitespace-collapsed and truncated. Never stored. */
  text: string | null;
};

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/** Main article text via Readability, falling back to the body's visible text. */
export function extractMainText(html: string, url: URL, maxChars = MAX_CONTENT_CHARS): string | null {
  const { document } = parseHTML(html);
  // Readability needs a base URL to resolve links; linkedom has no `documentURI`.
  try {
    Object.defineProperty(document, "documentURI", { value: url.toString() });
  } catch {
    // read-only in some builds; Readability still works without it
  }

  // Captions, infoboxes, tables and footnote markers read as noise in a summary.
  document
    .querySelectorAll("figure, figcaption, table, .infobox, .thumb, .hatnote, .navbox, .mw-editsection, sup.reference, [role=note]")
    .forEach((el) => el.remove());

  let text = "";
  try {
    const article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse();
    text = collapse(article?.textContent ?? "");
  } catch {
    // fall through to the body text
  }
  if (text.length < 200) {
    const { document: fresh } = parseHTML(html);
    fresh.querySelectorAll("script, style, noscript, template, svg, nav, footer, header, aside, form").forEach((el) => el.remove());
    const body = collapse(fresh.body?.textContent ?? "");
    if (body.length > text.length) text = body;
  }
  return text ? text.slice(0, maxChars) : null;
}

/**
 * Fetch the content to summarise. Untrusted input: callers pass it to the LLM
 * as quoted data only, and must not persist `text`.
 */
export async function fetchContent(originalUrl: string): Promise<PageContent> {
  const url = parseHttpUrl(originalUrl);
  if (!url) throw new Error("Invalid URL");

  // YouTube pages are mostly script; the Data API description is the content.
  if (youtubeVideoId(url)) {
    const m = await fetchMetadata(originalUrl);
    return { description: m.description, text: null };
  }

  const res = await safeFetch(url);
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
  if (!res.contentType.includes("html")) return { description: null, text: null };

  return {
    description: parseHtmlMetadata(res.body, res.finalUrl, res.contentType).description,
    text: extractMainText(res.body, res.finalUrl),
  };
}
