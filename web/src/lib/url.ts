import { createHash } from "node:crypto";

const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "igshid",
  "ref_src", "ref_url", "_hsenc", "_hsmi", "si", "spm", "yclid",
]);

/** Validate that a user-supplied string is an absolute http(s) URL. */
export function parseHttpUrl(input: string): URL | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  return url;
}

/**
 * Normalise a URL for dedupe purposes only. The original URL is always stored
 * and opened as-is; this form only feeds the hash.
 */
export function normalizeUrl(input: string | URL): string {
  const url = new URL(input.toString());
  url.hash = "";
  url.username = "";
  url.password = "";
  url.protocol = "https:"; // treat http/https as the same resource
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  url.port = "";

  const kept = [...url.searchParams.entries()]
    .filter(([k]) => !k.toLowerCase().startsWith("utm_") && !TRACKING_PARAMS.has(k.toLowerCase()))
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  url.search = "";
  for (const [k, v] of kept) url.searchParams.append(k, v);

  // youtu.be/<id> and m.youtube.com -> youtube.com/watch?v=<id>
  const yt = youtubeVideoId(url);
  if (yt) return `https://youtube.com/watch?v=${yt}`;

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

export function hashUrl(input: string | URL): string {
  return createHash("sha256").update(normalizeUrl(input)).digest("hex");
}

export function youtubeVideoId(input: string | URL): string | null {
  const url = new URL(input.toString());
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const valid = (id: string | null | undefined) => (id && /^[\w-]{11}$/.test(id) ? id : null);
  if (host === "youtu.be") return valid(url.pathname.slice(1).split("/")[0]);
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") return valid(url.searchParams.get("v"));
    const m = url.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{11})/);
    if (m) return valid(m[2]);
  }
  return null;
}

/** Pull the first http(s) URL out of free text (Android share often puts it in `text`). */
export function extractUrl(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (!c) continue;
    if (parseHttpUrl(c)) return c.trim();
    const m = c.match(/https?:\/\/[^\s<>"']+/i);
    if (m && parseHttpUrl(m[0])) return m[0].replace(/[).,;!?]+$/, "");
  }
  return null;
}
