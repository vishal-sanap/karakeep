import { describe, expect, it } from "vitest";
import { clampSummary, normalizeTags } from "./claude";
import { embeddingText, toPgVector } from "./embeddings";

describe("normalizeTags", () => {
  it("lowercases, trims, dedupes and caps at 7", () => {
    expect(normalizeTags([" Note-Taking ", "#Zettelkasten", "note-taking", "", "a b c d", "x", "y", "z", "w", "v", "u"])).toEqual([
      "note-taking",
      "zettelkasten",
      "x",
      "y",
      "z",
      "w",
      "v",
    ]);
  });
});

describe("clampSummary", () => {
  it("keeps at most two sentences", () => {
    expect(clampSummary("One.  Two!  Three? Four.")).toBe("One. Two!");
  });
  it("leaves short text alone", () => {
    expect(clampSummary("A single sentence without a full stop")).toBe("A single sentence without a full stop");
  });
  it("caps length", () => {
    const s = clampSummary("x".repeat(600));
    expect(s.length).toBe(398);
    expect(s.endsWith("…")).toBe(true);
  });
});

describe("embeddingText", () => {
  it("includes everything a vague memory might hit, skipping empties", () => {
    const text = embeddingText({
      title: "Zettelkasten",
      summary: "A note-taking method.",
      tags: ["notes", "pkm"],
      why_note: "for my thesis",
      domain: "wikipedia.org",
      original_url: "https://en.wikipedia.org/wiki/Zettelkasten",
    });
    expect(text).toBe(
      "Zettelkasten\nA note-taking method.\nTopics: notes, pkm\nWhy I saved it: for my thesis\nSource: wikipedia.org",
    );
  });
  it("falls back to the URL without a title", () => {
    const text = embeddingText({ title: null, summary: null, tags: [], why_note: null, domain: null, original_url: "https://a.com/x" });
    expect(text).toBe("https://a.com/x");
  });
});

it("formats pgvector literals", () => {
  expect(toPgVector([0.5, -1, 2e-3])).toBe("[0.5,-1,0.002]");
});
