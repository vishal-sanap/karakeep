/**
 * Pure clustering helpers for threads. Vectors are assumed L2-normalised
 * (cosine similarity == dot product), as produced by the embedder.
 */

export const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

/**
 * Average-linkage agglomerative clustering with a similarity cut-off: keep
 * merging the two closest groups while their average pairwise similarity is
 * at least `minSim`. Returns groups of indices (singletons included).
 *
 * O(n^2) memory, roughly O(n^2) time in practice via cached best neighbours;
 * comfortable for a personal library of a few thousand items.
 */
export function agglomerate(vectors: ArrayLike<number>[], minSim: number): number[][] {
  const n = vectors.length;
  if (n === 0) return [];
  const S = new Float32Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = dot(vectors[i], vectors[j]);
      S[i * n + j] = s;
      S[j * n + i] = s;
    }
  }
  const active = new Uint8Array(n).fill(1);
  const size = new Int32Array(n).fill(1);
  const members: number[][] = Array.from({ length: n }, (_, i) => [i]);
  const best = new Int32Array(n).fill(-1);
  const bestSim = new Float32Array(n).fill(-Infinity);

  const refresh = (i: number) => {
    best[i] = -1;
    bestSim[i] = -Infinity;
    for (let k = 0; k < n; k++) {
      if (k !== i && active[k] && S[i * n + k] > bestSim[i]) {
        bestSim[i] = S[i * n + k];
        best[i] = k;
      }
    }
  };
  for (let i = 0; i < n; i++) refresh(i);

  for (;;) {
    let a = -1;
    for (let i = 0; i < n; i++) if (active[i] && best[i] >= 0 && (a < 0 || bestSim[i] > bestSim[a])) a = i;
    if (a < 0 || bestSim[a] < minSim) break;
    const b = best[a];

    // Merge b into a; Lance-Williams update for average linkage.
    for (let k = 0; k < n; k++) {
      if (!active[k] || k === a || k === b) continue;
      const s = (size[a] * S[a * n + k] + size[b] * S[b * n + k]) / (size[a] + size[b]);
      S[a * n + k] = s;
      S[k * n + a] = s;
    }
    size[a] += size[b];
    members[a].push(...members[b]);
    active[b] = 0;

    for (let k = 0; k < n; k++) {
      if (!active[k]) continue;
      if (k === a || best[k] === a || best[k] === b) refresh(k);
      else if (S[k * n + a] > bestSim[k]) {
        bestSim[k] = S[k * n + a];
        best[k] = a;
      }
    }
  }
  return members.filter((_, i) => active[i]);
}

/** Normalised mean of the given vectors. */
export function centroid(vectors: ArrayLike<number>[]): number[] {
  const dim = vectors[0]?.length ?? 0;
  const c = new Array<number>(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) c[i] += v[i];
  const norm = Math.hypot(...c) || 1;
  return c.map((x) => x / norm);
}

const jaccard = (a: Set<string>, b: Set<string>) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
};

/**
 * Keep thread ids stable across rebuilds: greedily pair each new cluster with
 * the old thread sharing the most members (Jaccard >= minOverlap). Returns,
 * per new cluster, the matched old id and overlap (or null).
 */
export function matchClusters(
  next: string[][],
  previous: { id: string; members: string[] }[],
  minOverlap = 0.3,
): ({ id: string; overlap: number } | null)[] {
  const nextSets = next.map((m) => new Set(m));
  const prevSets = previous.map((p) => new Set(p.members));
  const pairs: { i: number; j: number; o: number }[] = [];
  for (let i = 0; i < nextSets.length; i++)
    for (let j = 0; j < prevSets.length; j++) {
      const o = jaccard(nextSets[i], prevSets[j]);
      if (o >= minOverlap) pairs.push({ i, j, o });
    }
  pairs.sort((x, y) => y.o - x.o);
  const out: ({ id: string; overlap: number } | null)[] = next.map(() => null);
  const usedPrev = new Set<number>();
  for (const { i, j, o } of pairs) {
    if (out[i] || usedPrev.has(j)) continue;
    out[i] = { id: previous[j].id, overlap: o };
    usedPrev.add(j);
  }
  return out;
}
