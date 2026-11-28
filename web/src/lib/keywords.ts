/**
 * LLM-free text helpers: extractive summaries, keyword tags, thread names and
 * shared-topic hints. Deterministic and cheap; quality is "good enough to scan".
 */

// Common English function words plus web boilerplate that makes poor tags.
const STOPWORDS = new Set(
  `a about above after again against all also am an and any are aren't as at be because been before being below between both
  but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further get gets
  got had hadn't has hasn't have haven't having he her here hers herself him himself his how however i if in into is isn't it
  it's its itself just let's like make makes made many may me might more most much must my myself new no nor not now of off
  on once one only or other ought our ours ourselves out over own per same she should shouldn't so some such than that that's
  the their theirs them themselves then there there's these they this those through to too two under until up upon us use used
  using very via was wasn't way we well were weren't what when where which while who whom why will with within without won't
  would wouldn't yet you your yours yourself yourselves
  page pages site website web home menu login sign log subscribe newsletter cookie cookies privacy policy terms share click
  read reading article articles post posts blog video videos watch youtube com www http https html amp copyright rights
  reserved contact account search skip content main navigation toggle free best top first last year years day days time
  thing things lot really even still ever every know see said says say want need going go come back good great better
  something anything everything nothing someone people part parts world often always never another around across along
  available following including include includes based different important example examples number numbers
  find found kind kinds inside whole bring brings take takes took give gives look looks looking keep start started
  try tried put able sure maybe probably actually simply basically quite rather almost enough less least`.split(/\s+/),
);

// Unicode letters, so "Sönke" or "Zettelkästen" stay whole words.
const WORD = /\p{L}[\p{L}\p{N}+#'-]*[\p{L}\p{N}+#]|\p{L}/gu;

export function tokenize(text: string): string[] {
  return (text.toLowerCase().replace(/’/g, "'").replace(/'s\b/g, "").match(WORD) ?? []).filter(
    // contractions ("you're", "don't") are never topics
    (w) => w.length > 2 && w.length < 30 && !STOPWORDS.has(w) && !/^\d/.test(w) && !w.includes("'"),
  );
}

/** Light singularisation so "startup" and "startups" count as one term. */
const singular = (w: string) => (w.length > 4 && /[^suia]s$/.test(w) ? w.slice(0, -1) : w);
const termKey = (t: string) => t.split(" ").map(singular).join(" ");

/** Unigrams plus adjacent bigrams (within the same clause, both non-stopwords). */
function terms(text: string): string[] {
  const out: string[] = [];
  for (const clause of text.toLowerCase().split(/[.,;:!?()[\]{}"“”|\n\r\t–—/\\]+/)) {
    const words = tokenize(clause);
    for (let i = 0; i < words.length; i++) {
      out.push(words[i]);
      if (i + 1 < words.length) out.push(`${words[i]} ${words[i + 1]}`);
    }
  }
  return out;
}

/**
 * Drop a trailing site name: "Zettelkasten - Wikipedia" -> "Zettelkasten".
 * Only when the suffix is short, so real subtitles survive.
 */
export function titleCore(title: string | null): string | null {
  if (!title) return title;
  const m = /^(.{8,}?)\s+[-–—|·:]\s+([^-–—|·:]{1,40})$/.exec(title.trim());
  return m && m[2].trim().split(/\s+/).length <= 4 ? m[1] : title;
}

export type TagSource = { title: string | null; description: string | null; body: string | null };

/**
 * 3-6 keyword tags. Title terms weigh most, then description, then body.
 * `docFreq(term)` (fraction of the library containing the term, 0-1) pushes
 * library-wide common words down; omit it for a fresh library.
 */
export function extractTags(src: TagSource, opts: { max?: number; docFreq?: (term: string) => number } = {}): string[] {
  const max = opts.max ?? 6;
  // Keyed by singular form; display the first surface form seen (title first).
  const score = new Map<string, number>();
  const count = new Map<string, number>();
  const display = new Map<string, string>();
  const add = (text: string | null, weight: number) => {
    if (!text) return;
    for (const t of terms(text)) {
      const k = termKey(t);
      if (!display.has(k)) display.set(k, t);
      score.set(k, (score.get(k) ?? 0) + weight * (t.includes(" ") ? 1.6 : 1));
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  };
  add(titleCore(src.title), 4);
  add(src.description, 2);
  add(src.body?.slice(0, 8000) ?? null, 0.25);

  const ranked = [...score.entries()]
    // A phrase seen only once is usually just adjacent words, not a topic.
    .filter(([k]) => !k.includes(" ") || (count.get(k) ?? 0) >= 2)
    .map(([k, s]) => [k, s * (opts.docFreq ? Math.log(1 + 1 / Math.max(opts.docFreq(display.get(k)!), 0.02)) : 1)] as const)
    // A word seen once in the body alone is noise.
    .filter(([, s]) => s >= 0.75)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  // Never two tags sharing a word: "index cards" beats "index" and "cards", and
  // overlapping title phrases ("fastest growing", "growing bootstrapped") don't chain.
  const picked: string[] = [];
  for (const [k] of ranked) {
    if (picked.length >= max) break;
    const words = k.split(" ");
    const clash = picked.findIndex((p) => p.split(" ").some((w) => words.includes(w)));
    if (clash === -1) picked.push(k);
    // a phrase replaces a single word it contains, if the phrase ranks next
    else if (words.length > 1 && !picked[clash].includes(" ") && words.includes(picked[clash])) picked[clash] = k;
  }
  return picked.map((k) => display.get(k)!);
}

// Wikipedia-style disambiguation notes and similar boilerplate.
const HATNOTE = /^(for (the|other|a|an)\b.*\bsee\b|this article is about|.*\bredirects here\b|not to be confused with)/i;
const DATELINE = /^(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:\d{1,2},?\s+)?\d{4})\s*([A-Z])/i;

/**
 * Two-sentence extractive summary: the page's own description if it has a
 * real one, otherwise the first substantial sentences of the main text.
 */
export function extractSummary(description: string | null, body: string | null, maxChars = 320): string | null {
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  const desc = description ? clean(description) : "";
  if (desc.length >= 60) return clip(desc, maxChars);

  if (body) {
    const sentences = (clean(body).match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [])
      .map((s) => s.trim())
      // skip fragments, menus, and shouty or link-ish lines
      .filter((s) => s.length >= 40 && s.split(" ").length >= 7 && !/https?:|@/.test(s) && !HATNOTE.test(s))
      // a leading dateline ("July 2023If you…") isn't part of the sentence
      .map((s) => s.replace(DATELINE, "$1"));
    if (sentences.length) return clip(sentences.slice(0, 2).join(" "), maxChars);
  }
  return desc || null;
}

function clip(s: string, max: number) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = cut.lastIndexOf(". ");
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}…`;
}

/** Terms two items share (tags first, then title words): the LLM-free "why related". */
export function sharedTerms(
  a: { title: string | null; tags: string[] },
  b: { title: string | null; tags: string[] },
  max = 3,
): string[] {
  const out: string[] = [];
  const push = (t: string) => {
    if (out.length < max && !out.includes(t) && !out.some((o) => o.includes(t) || t.includes(o))) out.push(t);
  };
  const bTags = new Set(b.tags);
  const bTagWords = new Set(b.tags.flatMap((t) => t.split(" ")));
  for (const t of a.tags) if (bTags.has(t)) push(t);
  for (const t of a.tags) for (const w of t.split(" ")) if (bTagWords.has(w) && !STOPWORDS.has(w)) push(w);
  const bTitle = new Set(tokenize(titleCore(b.title) ?? ""));
  for (const w of tokenize(titleCore(a.title) ?? "")) if (bTitle.has(w)) push(w);
  return out;
}

/**
 * Thread name from its members: terms frequent inside the thread (c-TF-IDF),
 * discounted by how common they are across all threads. "Zettelkasten, notes, memory".
 */
export function nameCluster(
  members: { title: string | null; tags: string[] }[],
  allClusters: { title: string | null; tags: string[] }[][],
  maxTerms = 3,
): string {
  const bag = (ms: { title: string | null; tags: string[] }[]) => {
    const m = new Map<string, number>();
    for (const d of ms) {
      // count each term once per member so one long title can't dominate
      const ts = new Set([...d.tags.flatMap((t) => [t, ...t.split(" ")]), ...tokenize(titleCore(d.title) ?? "")]);
      for (const t of ts) if (!STOPWORDS.has(t) && t.length > 2) m.set(t, (m.get(t) ?? 0) + 1);
    }
    return m;
  };
  const mine = bag(members);
  const clusterDf = new Map<string, number>();
  for (const c of allClusters) for (const t of bag(c).keys()) clusterDf.set(t, (clusterDf.get(t) ?? 0) + 1);
  const n = Math.max(allClusters.length, 1);

  const ranked = [...mine.entries()]
    .filter(([, c]) => c >= Math.min(2, members.length)) // shared by at least two members
    .map(([t, c]) => [t, (c / members.length) * Math.log(1 + n / (clusterDf.get(t) ?? 1)) * (t.includes(" ") ? 1.3 : 1)] as const)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const picked: string[] = [];
  for (const [t] of ranked) {
    if (picked.length >= maxTerms) break;
    if (picked.some((p) => p.includes(t) || t.includes(p))) continue;
    picked.push(t);
  }
  if (!picked.length) return members[0]?.title?.slice(0, 40) ?? "Untitled thread";
  // Sentence case, comma-separated: "Notes, flashcards, memory".
  const name = picked.join(", ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}
