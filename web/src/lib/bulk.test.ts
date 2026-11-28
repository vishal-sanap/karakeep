import { describe, expect, it } from "vitest";
import { MAX_IMPORT, parseLinks, toBookmarksHtml, toCsv, toTxt } from "./bulk";

describe("parseLinks", () => {
  it("pulls links out of messy pasted text, trimming punctuation and dropping dupes", () => {
    const text = `Check these out:
      https://paulgraham.com/greatwork.html, and (https://en.wikipedia.org/wiki/Zettelkasten).
      also https://example.com/a?x=1#frag
      https://paulgraham.com/greatwork.html again! ftp://nope.com mailto:a@b.com`;
    const r = parseLinks(text);
    expect(r.format).toBe("text");
    expect(r.entries.map((e) => e.url)).toEqual([
      "https://paulgraham.com/greatwork.html",
      "https://en.wikipedia.org/wiki/Zettelkasten",
      "https://example.com/a?x=1#frag",
    ]);
    expect(r.duplicates).toBe(1);
  });

  it("keeps a balanced closing paren that is part of the URL", () => {
    expect(parseLinks("see https://en.wikipedia.org/wiki/Mercury_(planet) now").entries[0].url).toBe(
      "https://en.wikipedia.org/wiki/Mercury_(planet)",
    );
  });

  it("reads CSV cells", () => {
    const csv = 'url,title\r\nhttps://a.com/1,"First, with comma"\r\nhttps://b.com/2,Second\r\n';
    expect(parseLinks(csv, "links.csv").entries.map((e) => e.url)).toEqual(["https://a.com/1", "https://b.com/2"]);
  });

  it("reads browser bookmark files, ignoring icon URLs", () => {
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
      <DL><p><DT><A HREF="https://a.com/x?y=1&amp;z=2" ICON_URI="https://a.com/favicon.ico" ICON="data:image/png;base64,AAA">A</A>
      <DT><A HREF="javascript:alert(1)">bad</A>
      <DT><A HREF="https://b.com/">B</A></DL>`;
    const r = parseLinks(html, "bookmarks.html");
    expect(r.format).toBe("bookmarks");
    expect(r.entries.map((e) => e.url)).toEqual(["https://a.com/x?y=1&z=2", "https://b.com/"]);
  });

  it("reads our own JSON export, keeping why-notes and skipping thumbnail URLs", () => {
    const json = JSON.stringify({
      exported_at: "2026-11-28",
      items: [
        { original_url: "https://a.com/1", why_note: "for the thesis", thumbnail_url: "https://cdn.a.com/t.jpg" },
        { original_url: "https://b.com/2", why_note: null },
      ],
    });
    const r = parseLinks(json, "unfold-export.json");
    expect(r.format).toBe("json");
    expect(r.entries).toEqual([{ url: "https://a.com/1", why_note: "for the thesis" }, { url: "https://b.com/2" }]);
  });

  it("caps very large imports", () => {
    const many = Array.from({ length: MAX_IMPORT + 5 }, (_, i) => `https://a.com/${i}`).join("\n");
    const r = parseLinks(many);
    expect(r.entries).toHaveLength(MAX_IMPORT);
    expect(r.truncated).toBe(true);
  });
});

describe("export formats", () => {
  const items = [
    { original_url: "https://a.com/1", title: 'Quote "and", comma', summary: null, why_note: "line\nbreak", tags: ["x", "y"], saved_at: "2026-11-25T10:00:00Z" },
    { original_url: "https://b.com/<2>", title: null, summary: "s", why_note: null, tags: [], saved_at: "2026-11-26T10:00:00Z" },
  ];
  it("CSV quotes cells that need it", () => {
    const csv = toCsv(items);
    expect(csv.split("\r\n")[0]).toBe("url,title,why_note,tags,saved_at,summary");
    expect(csv).toContain('"Quote ""and"", comma"');
    expect(csv).toContain('"line\nbreak"');
  });
  it("TXT is one URL per line", () => {
    expect(toTxt(items)).toBe("https://a.com/1\nhttps://b.com/<2>\n");
  });
  it("bookmarks HTML escapes and round-trips through the importer", () => {
    const html = toBookmarksHtml(items);
    expect(html).toContain("&lt;2&gt;");
    expect(parseLinks(html, "b.html").entries.map((e) => e.url)).toEqual(["https://a.com/1", "https://b.com/%3C2%3E"]);
  });
  it("JSON export round-trips through the importer", () => {
    const json = JSON.stringify({ items });
    expect(parseLinks(json).entries[0]).toEqual({ url: "https://a.com/1", why_note: "line\nbreak" });
  });
});
