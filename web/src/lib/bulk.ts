/**
 * Bulk import/export helpers. Pure (no Node APIs) so the browser can parse a
 * pasted list or an uploaded file without uploading it whole; the server
 * re-validates and normalises every URL on save.
 */

export const MAX_IMPORT = 1000;

export type ImportEntry = { url: string; why_note?: string | null };
export type ParseResult = { entries: ImportEntry[]; duplicates: number; format: "json" | "bookmarks" | "text"; truncated: boolean };

// http(s) URLs in free text; stops at whitespace, quotes, angle brackets.
const URL_RE = /https?:\/\/[^\s"'<>`]+/gi;

/** `fromProse`: the URL was found in free text, so trailing punctuation is probably not part of it. */
function cleanUrl(raw: string, fromProse: boolean): string | null {
  let s = raw.trim();
  if (fromProse) {
    // "see https://a.com/x)." -> ".../x"
    s = s.replace(/[.,;:!?'")\]}>]+$/, "");
    // Keep a closing paren that balances one inside the URL (Wikipedia style).
    if (raw.trim().endsWith(")") && (s.match(/\(/g)?.length ?? 0) > (s.match(/\)/g)?.length ?? 0)) s += ")";
  }
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (s.length > 4096) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

function fromJson(text: string): ImportEntry[] | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  // Our export ({ items: [...] }), a bare array of objects, or an array of strings.
  const list = Array.isArray(data) ? data : Array.isArray((data as { items?: unknown })?.items) ? (data as { items: unknown[] }).items : null;
  if (!list) return null;
  const out: ImportEntry[] = [];
  for (const x of list) {
    if (typeof x === "string") out.push({ url: x });
    else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      const url = [o.original_url, o.url, o.href, o.link].find((v) => typeof v === "string") as string | undefined;
      if (url) out.push({ url, why_note: typeof o.why_note === "string" ? o.why_note : null });
    }
  }
  return out;
}

/** Browser bookmark export (Netscape format): only <A HREF> targets, not icon URIs. */
function fromBookmarks(html: string): ImportEntry[] {
  const out: ImportEntry[] = [];
  for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*"([^"]+)"/gi)) out.push({ url: decodeEntities(m[1]) });
  return out;
}

/** Cells of one CSV line (handles quoted cells with commas and doubled quotes). */
function csvCells(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";" || ch === "\t") {
      cells.push(cur);
      cur = "";
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
}

export function parseLinks(text: string, filename = ""): ParseResult {
  const t = text.trim();
  let format: ParseResult["format"] = "text";
  let raw: ImportEntry[] | null = null;
  if (/\.json$/i.test(filename) || /^[[{]/.test(t)) {
    raw = fromJson(t);
    if (raw) format = "json";
  }
  if (!raw && (/\.html?$/i.test(filename) || /<!DOCTYPE NETSCAPE-Bookmark|<a\s[^>]*href=/i.test(t))) {
    raw = fromBookmarks(t);
    format = "bookmarks";
  }
  if (!raw) {
    // CSV: split into cells first so a URL can't run into the next column.
    const chunks = /\.csv$/i.test(filename) ? t.split(/\r?\n/).flatMap(csvCells) : [t];
    raw = chunks.flatMap((c) => [...c.matchAll(URL_RE)].map((m) => ({ url: m[0] })));
  }
  const fromProse = format === "text";

  const seen = new Set<string>();
  const entries: ImportEntry[] = [];
  let duplicates = 0;
  for (const e of raw) {
    const url = cleanUrl(e.url, fromProse);
    if (!url) continue;
    const key = url.replace(/#.*$/, "").replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    const why = e.why_note?.trim().slice(0, 500);
    entries.push(why ? { url, why_note: why } : { url });
  }
  const truncated = entries.length > MAX_IMPORT;
  return { entries: entries.slice(0, MAX_IMPORT), duplicates, format, truncated };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export type ExportItem = {
  original_url: string;
  title: string | null;
  summary: string | null;
  why_note: string | null;
  tags: string[];
  saved_at: Date | string;
};

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(items: ExportItem[]): string {
  const rows = [["url", "title", "why_note", "tags", "saved_at", "summary"]];
  for (const d of items)
    rows.push([d.original_url, d.title ?? "", d.why_note ?? "", d.tags.join("; "), new Date(d.saved_at).toISOString(), d.summary ?? ""]);
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export const toTxt = (items: ExportItem[]) => items.map((d) => d.original_url).join("\n") + "\n";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Netscape bookmark file: importable by Chrome, Firefox, Safari and Edge. */
export function toBookmarksHtml(items: ExportItem[]): string {
  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
    "    <DT><H3>unfold</H3>",
    "    <DL><p>",
  ];
  for (const d of items) {
    const added = Math.floor(new Date(d.saved_at).getTime() / 1000);
    const tags = d.tags.length ? ` TAGS="${esc(d.tags.join(","))}"` : "";
    lines.push(`        <DT><A HREF="${esc(d.original_url)}" ADD_DATE="${added}"${tags}>${esc(d.title ?? d.original_url)}</A>`);
    if (d.why_note) lines.push(`        <DD>${esc(d.why_note)}`);
  }
  lines.push("    </DL><p>", "</DL><p>");
  return lines.join("\n") + "\n";
}
