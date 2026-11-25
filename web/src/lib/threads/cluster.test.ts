import { describe, expect, it } from "vitest";
import { agglomerate, centroid, dot, matchClusters } from "./cluster";

const norm = (v: number[]) => {
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
};
// Points scattered around three directions in 4-d space, plus one loner.
const around = (axis: number, jitter: number[]) => norm([0, 0, 0, 0].map((_, i) => (i === axis ? 1 : 0) + jitter[i]));
const A = [around(0, [0, 0.1, 0, 0]), around(0, [0, 0, 0.1, 0]), around(0, [0, 0.05, 0.05, 0])];
const B = [around(1, [0.1, 0, 0, 0]), around(1, [0, 0, 0.1, 0]), around(1, [0, 0, 0, 0.12]), around(1, [0.05, 0, 0.05, 0])];
const loner = norm([0.3, 0.3, 0.3, 1]);

describe("agglomerate", () => {
  it("finds the groups and leaves the loner alone", () => {
    const vecs = [...A, ...B, loner];
    const groups = agglomerate(vecs, 0.8).map((g) => g.sort((x, y) => x - y)).sort((x, y) => x[0] - y[0]);
    expect(groups).toEqual([[0, 1, 2], [3, 4, 5, 6], [7]]);
  });

  it("merges everything at a low cut-off and nothing at a high one", () => {
    const vecs = [...A, ...B];
    expect(agglomerate(vecs, -1)).toHaveLength(1);
    expect(agglomerate(vecs, 0.9999)).toHaveLength(vecs.length);
  });

  it("handles empty and single inputs", () => {
    expect(agglomerate([], 0.5)).toEqual([]);
    expect(agglomerate([A[0]], 0.5)).toEqual([[0]]);
  });
});

describe("centroid", () => {
  it("is normalised and points at the group", () => {
    const c = centroid(A);
    expect(Math.hypot(...c)).toBeCloseTo(1, 6);
    expect(dot(c, A[0])).toBeGreaterThan(0.95);
    expect(dot(c, B[0])).toBeLessThan(0.3);
  });
});

describe("matchClusters", () => {
  const prev = [
    { id: "t-notes", members: ["a", "b", "c"] },
    { id: "t-startups", members: ["x", "y", "z"] },
    { id: "t-gone", members: ["p", "q", "r"] },
  ];
  it("keeps ids for clusters that mostly persist", () => {
    const out = matchClusters([["x", "y", "z", "w"], ["a", "b", "c", "d"], ["m", "n", "o"]], prev);
    expect(out[0]?.id).toBe("t-startups");
    expect(out[1]?.id).toBe("t-notes");
    expect(out[2]).toBeNull(); // brand-new cluster
  });
  it("never reuses one old id twice", () => {
    const out = matchClusters([["a", "b"], ["a", "b", "c"]], prev);
    expect(out.filter((o) => o?.id === "t-notes")).toHaveLength(1);
    expect(out[1]?.id).toBe("t-notes"); // the better overlap wins
  });
});
