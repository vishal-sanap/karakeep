import * as cheerio from "cheerio";
import { safeFetch } from "./fetcher";
import { env } from "./env";
import { parseHttpUrl, youtubeVideoId } from "./url";

/** A failure retrying won't fix (e.g. 404, 410, 403). */
export class PermanentFetchError extends Error {}

export type PageMetadata = {
  canonicalUrl: string | null;
  title: string | null;
  description: string | null;
  resourceType: string;
  domain: string;
  thumbnailUrl: string | null;
  faviconUrl: string | null;
};

const clean = (s: string | undefined | null, max = 500) => {
  const v = s?.replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : null;
};

/** Only keep http(s) absolute URLs from page-supplied attributes. */
const absUrl = (href: string | undefined, base: URL) => {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};

function typeFrom(ogType: string | null, contentType: string, url: URL): string {
  if (contentType.includes("application/pdf") || url.pathname.toLowerCase().endsWith(".pdf")) return "pdf";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  const host = url.hostname.replace(/^www\./, "");
  if (host === "github.com") return "repo";
  if (/(^|\.)(twitter|x)\.com$/.test(host)) return "post";
  if (ogType?.startsWith("video")) return "video";
  if (ogType === "article") return "article";
  return "webpage";
}

export function parseHtmlMetadata(html: string, finalUrl: URL, contentType: string): PageMetadata {
  const $ = cheerio.load(html);
  const meta = (sel: string) => $(`meta[${sel}]`).attr("content");

  const canonical = absUrl($('link[rel="canonical"]').attr("href"), finalUrl);
  const ogType = clean(meta('property="og:type"'), 50);
  const icon =
    $('link[rel="icon"][sizes="32x32"]').attr("href") ??
    $('link[rel="icon"]').attr("href") ??
    $('link[rel="shortcut icon"]').attr("href") ??
    $('link[rel="apple-touch-icon"]').attr("href") ??
    "/favicon.ico";

  return {
    canonicalUrl: canonical,
    title: clean(meta('property="og:title"') ?? meta('name="twitter:title"') ?? $("title").first().text(), 300),
    description: clean(meta('property="og:description"') ?? meta('name="description"') ?? meta('name="twitter:description"'), 1000),
    resourceType: typeFrom(ogType, contentType, finalUrl),
    domain: finalUrl.hostname.replace(/^www\./, ""),
    thumbnailUrl: absUrl(meta('property="og:image"') ?? meta('name="twitter:image"'), finalUrl),
    faviconUrl: absUrl(icon, finalUrl),
  };
}

async function youtubeMetadata(videoId: string): Promise<PageMetadata | null> {
  const key = env().YOUTUBE_API_KEY;
  if (!key) return null;
  const api = new URL("https://www.googleapis.com/youtube/v3/videos");
  api.searchParams.set("part", "snippet");
  api.searchParams.set("id", videoId);
  api.searchParams.set("key", key);
  const res = await fetch(api, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  const data = (await res.json()) as {
    items?: { snippet: { title: string; description: string; channelTitle: string; thumbnails: Record<string, { url: string }> } }[];
  };
  const s = data.items?.[0]?.snippet;
  if (!s) return null;
  const thumb = s.thumbnails.maxres ?? s.thumbnails.high ?? s.thumbnails.medium ?? s.thumbnails.default;
  return {
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title: clean(s.title, 300),
    description: clean(`${s.channelTitle}: ${s.description}`, 1000),
    resourceType: "video",
    domain: "youtube.com",
    thumbnailUrl: thumb?.url ?? null,
    faviconUrl: "https://www.youtube.com/favicon.ico",
  };
}

export async function fetchMetadata(originalUrl: string): Promise<PageMetadata> {
  const url = parseHttpUrl(originalUrl);
  if (!url) throw new Error("Invalid URL");

  const yt = youtubeVideoId(url);
  if (yt) {
    const m = await youtubeMetadata(yt);
    if (m) return m;
  }

  const res = await safeFetch(url);
  if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
    throw new PermanentFetchError(`HTTP ${res.status}`);
  }
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
  if (!res.contentType.includes("html")) {
    return {
      canonicalUrl: null,
      title: decodeURIComponent(res.finalUrl.pathname.split("/").pop() || res.finalUrl.hostname),
      description: null,
      resourceType: typeFrom(null, res.contentType, res.finalUrl),
      domain: res.finalUrl.hostname.replace(/^www\./, ""),
      thumbnailUrl: null,
      faviconUrl: absUrl("/favicon.ico", res.finalUrl),
    };
  }
  return parseHtmlMetadata(res.body, res.finalUrl, res.contentType);
}
