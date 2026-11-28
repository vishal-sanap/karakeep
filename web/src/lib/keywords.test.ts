import { describe, expect, it } from "vitest";
import { extractSummary, extractTags, nameCluster, sharedTerms, titleCore, tokenize } from "./keywords";

describe("tokenize", () => {
  it("drops stopwords, numbers, short words and possessives", () => {
    expect(tokenize("The Zettelkasten's 2 index cards and a system for ideas")).toEqual(["zettelkasten", "index", "cards", "system", "ideas"]);
  });
  it("keeps accented and non-English words whole", () => {
    expect(tokenize("Sönke Ahrens on Zettelkästen")).toEqual(["sönke", "ahrens", "zettelkästen"]);
  });
});

describe("extractTags", () => {
  const src = {
    title: "Zettelkasten - Wikipedia",
    description: "The zettelkasten is a method of note-taking and personal knowledge management using index cards.",
    body: "Niklas Luhmann used a zettelkasten of index cards. Each card has an address. Index cards link to other index cards.",
  };

  it("favours title and description terms and merges bigrams", () => {
    const tags = extractTags(src);
    expect(tags[0]).toBe("zettelkasten");
    expect(tags).toContain("index cards");
    expect(tags).not.toContain("index");
    expect(tags.join(" ")).not.toContain("wikipedia");
    expect(tags.length).toBeLessThanOrEqual(6);
  });

  it("pushes library-common terms down", () => {
    const common = extractTags(src, { docFreq: (t) => (t === "zettelkasten" ? 0.9 : 0.05) });
    expect(common[0]).not.toBe("zettelkasten");
  });

  it("returns nothing for empty input", () => {
    expect(extractTags({ title: null, description: null, body: null })).toEqual([]);
  });
});

describe("titleCore", () => {
  it("strips short site suffixes but keeps real subtitles", () => {
    expect(titleCore("Zettelkasten - Wikipedia")).toBe("Zettelkasten");
    expect(titleCore("How to Do Great Work | Paul Graham")).toBe("How to Do Great Work");
    expect(titleCore("Rust: a language empowering everyone to build reliable and efficient software")).toBe(
      "Rust: a language empowering everyone to build reliable and efficient software",
    );
  });
});

describe("extractSummary", () => {
  it("uses a real description", () => {
    expect(extractSummary("A long enough page description that says what this page covers in detail.", "body")).toBe(
      "A long enough page description that says what this page covers in detail.",
    );
  });
  it("falls back to the first substantial body sentences", () => {
    const body = "Menu. Home. The zettelkasten method links small notes into a web of ideas over many years. Luhmann wrote seventy books with it this way. A third sentence follows here too.";
    expect(extractSummary("Short", body)).toBe(
      "The zettelkasten method links small notes into a web of ideas over many years. Luhmann wrote seventy books with it this way.",
    );
  });
  it("skips hatnotes and strips a leading dateline", () => {
    const body =
      "For the use of cards in library cataloguing, see Card catalog. July 2023If you collected lists of techniques for great work, what would the intersection look like?";
    expect(extractSummary(null, body)).toBe("If you collected lists of techniques for great work, what would the intersection look like?");
  });
  it("clips long text at a sentence or word boundary", () => {
    const s = extractSummary("word ".repeat(200), null, 50)!;
    expect(s.length).toBeLessThanOrEqual(51);
    expect(s.endsWith("…")).toBe(true);
  });
  it("returns null with nothing to go on", () => {
    expect(extractSummary(null, null)).toBeNull();
  });
});

describe("sharedTerms", () => {
  it("prefers shared tags, then shared tag words and title words", () => {
    expect(
      sharedTerms(
        { title: "Spaced repetition for memory", tags: ["spaced repetition", "memory", "anki"] },
        { title: "How memory works", tags: ["memory", "learning", "repetition"] },
      ),
    ).toEqual(["memory", "repetition"]);
  });
});

describe("nameCluster", () => {
  it("names a thread by its shared, distinctive terms", () => {
    const notes = [
      { title: "Zettelkasten method", tags: ["zettelkasten", "note-taking"] },
      { title: "How to take smart notes", tags: ["note-taking", "zettelkasten", "writing"] },
      { title: "Evergreen notes", tags: ["note-taking", "writing"] },
    ];
    const startups = [
      { title: "Bootstrapped startup growth", tags: ["startups", "bootstrapping"] },
      { title: "Startup funding", tags: ["startups", "fundraising"] },
    ];
    const name = nameCluster(notes, [notes, startups]);
    expect(name.startsWith("Note-Taking")).toBe(true); // shared by all three
    expect(name.split(" · ")).toHaveLength(3);
    expect(name).not.toMatch(/Startup/);
    expect(nameCluster(startups, [notes, startups])).toMatch(/^Startup/);
  });
  it("falls back to a member title", () => {
    expect(nameCluster([{ title: "Alpha", tags: [] }, { title: "Beta", tags: [] }], [])).toBe("Alpha");
  });
});
