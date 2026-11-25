import { describe, expect, it } from "vitest";
import { extractMainText } from "./extract";

const url = new URL("https://example.com/post");
const para = (n: number) =>
  Array.from({ length: n }, (_, i) => `<p>Paragraph ${i} about spaced repetition and how memory consolidates over time.</p>`).join("");

describe("extractMainText", () => {
  it("pulls the article body and drops navigation and scripts", () => {
    const html = `<html><head><title>T</title><script>var secret = 1;</script></head><body>
      <nav>Home | About | Login</nav>
      <article><h1>Spaced repetition</h1>${para(12)}</article>
      <footer>© 2026 Footer text</footer></body></html>`;
    const text = extractMainText(html, url)!;
    expect(text).toContain("spaced repetition");
    expect(text).not.toContain("var secret");
    expect(text).not.toContain("Login");
    expect(text).not.toMatch(/\s{2,}/);
  });

  it("falls back to body text for short pages", () => {
    const html = `<html><body><div>Short note on <b>zettelkasten</b>.</div><script>x()</script></body></html>`;
    expect(extractMainText(html, url)).toBe("Short note on zettelkasten.");
  });

  it("truncates to the cap", () => {
    const html = `<html><body><article>${para(400)}</article></body></html>`;
    expect(extractMainText(html, url, 500)!.length).toBe(500);
  });

  it("returns null for empty pages", () => {
    expect(extractMainText("<html><body></body></html>", url)).toBeNull();
  });
});
