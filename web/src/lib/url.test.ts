import { describe, expect, it } from "vitest";
import { extractUrl, hashUrl, normalizeUrl, parseHttpUrl, youtubeVideoId } from "./url";

describe("normalizeUrl", () => {
  it("treats trivially different URLs as the same", () => {
    const variants = [
      "https://www.example.com/post/1/?utm_source=x&b=2&a=1#section",
      "http://example.com/post/1?a=1&b=2",
      "https://EXAMPLE.com:443/post/1?fbclid=abc&a=1&b=2",
    ];
    const hashes = new Set(variants.map(hashUrl));
    expect(hashes.size).toBe(1);
  });

  it("keeps meaningful query params distinct", () => {
    expect(hashUrl("https://example.com/?id=1")).not.toBe(hashUrl("https://example.com/?id=2"));
  });

  it("canonicalises YouTube forms", () => {
    const id = "dQw4w9WgXcQ";
    for (const u of [
      `https://youtu.be/${id}?si=abc`,
      `https://m.youtube.com/watch?v=${id}&t=10`,
      `https://www.youtube.com/shorts/${id}`,
    ]) {
      expect(normalizeUrl(u)).toBe(`https://youtube.com/watch?v=${id}`);
    }
  });
});

describe("parseHttpUrl", () => {
  it("rejects non-http schemes", () => {
    expect(parseHttpUrl("javascript:alert(1)")).toBeNull();
    expect(parseHttpUrl("file:///etc/passwd")).toBeNull();
    expect(parseHttpUrl("not a url")).toBeNull();
    expect(parseHttpUrl(" https://example.com ")?.hostname).toBe("example.com");
  });
});

describe("extractUrl", () => {
  it("finds a link inside shared text", () => {
    expect(extractUrl(undefined, "Check this out https://example.com/a?b=1.")).toBe("https://example.com/a?b=1");
    expect(extractUrl("", "", "no link")).toBeNull();
  });
});

describe("youtubeVideoId", () => {
  it("ignores non-video pages", () => {
    expect(youtubeVideoId("https://youtube.com/@channel")).toBeNull();
  });
});
