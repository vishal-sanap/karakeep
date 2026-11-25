import { describe, expect, it } from "vitest";
import { EMBED_BODY_CHARS, embeddingText, toPgVector } from "./embeddings";

describe("embeddingText", () => {
  const base = {
    title: "Zettelkasten",
    summary: "A note-taking method.",
    tags: ["notes", "pkm"],
    why_note: "for my thesis",
    domain: "wikipedia.org",
    original_url: "https://en.wikipedia.org/wiki/Zettelkasten",
  };

  it("includes everything a vague memory might hit, skipping empties", () => {
    expect(embeddingText(base)).toBe(
      "Zettelkasten\nWhy I saved it: for my thesis\nA note-taking method.\nTopics: notes, pkm\nSource: wikipedia.org",
    );
  });

  it("appends the start of the page text, capped", () => {
    const text = embeddingText({ ...base, body: "x".repeat(EMBED_BODY_CHARS + 500) });
    expect(text.endsWith("x".repeat(EMBED_BODY_CHARS))).toBe(true);
    expect(text).not.toContain("x".repeat(EMBED_BODY_CHARS + 1));
  });

  it("falls back to the URL without a title", () => {
    const text = embeddingText({ title: null, summary: null, tags: [], why_note: null, domain: null, original_url: "https://a.com/x" });
    expect(text).toBe("https://a.com/x");
  });
});

it("formats pgvector literals", () => {
  expect(toPgVector([0.5, -1, 2e-3])).toBe("[0.5,-1,0.002]");
});
