import { describe, expect, it } from "vitest";
import { parseHtmlMetadata } from "./metadata";

const html = `<!doctype html><html><head>
  <title>  Fallback   title </title>
  <meta property="og:title" content="The Real Title">
  <meta property="og:description" content="A short description.">
  <meta property="og:type" content="article">
  <meta property="og:image" content="/img/cover.png">
  <link rel="canonical" href="https://example.org/posts/real">
  <link rel="icon" href="javascript:alert(1)">
</head><body></body></html>`;

describe("parseHtmlMetadata", () => {
  it("extracts OG metadata and resolves relative URLs", () => {
    const m = parseHtmlMetadata(html, new URL("https://www.example.org/posts/real?ref=x"), "text/html");
    expect(m).toMatchObject({
      title: "The Real Title",
      description: "A short description.",
      resourceType: "article",
      canonicalUrl: "https://example.org/posts/real",
      thumbnailUrl: "https://www.example.org/img/cover.png",
      domain: "example.org",
    });
  });

  it("drops non-http URLs supplied by the page", () => {
    const m = parseHtmlMetadata(html, new URL("https://example.org/"), "text/html");
    expect(m.faviconUrl).toBeNull();
  });

  it("falls back to <title> and classifies GitHub", () => {
    const m = parseHtmlMetadata("<title>repo</title>", new URL("https://github.com/a/b"), "text/html");
    expect(m.title).toBe("repo");
    expect(m.resourceType).toBe("repo");
  });
});
