import { describe, expect, it } from "vitest";

import { embeddingToBuffer } from "./embedding";
import {
  cosineSimilarity,
  expandQueryForRetrieval,
  rankChunks,
  type ScoredRow,
} from "./retrieve";

function vec(values: number[]): Float32Array {
  return new Float32Array(values);
}

function row(
  id: string,
  page: number,
  text: string,
  embedding: number[],
): ScoredRow {
  return {
    documentId: id,
    documentName: `doc-${id}`,
    pageNumber: page,
    chunkIndex: 0,
    text,
    embedding: embeddingToBuffer(embedding),
  };
}

describe("cosineSimilarity", () => {
  it("returns 1 for identical unit vectors", () => {
    const a = vec([1, 0, 0]);
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 6);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = vec([1, 0]);
    const b = vec([0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 6);
  });

  it("returns -1 for anti-parallel vectors", () => {
    const a = vec([1, 1, 0]);
    const b = vec([-1, -1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 6);
  });

  it("is invariant to magnitude", () => {
    const a = vec([1, 1, 1]);
    const b = vec([100, 100, 100]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 6);
  });

  it("handles zero vector by returning 0 (no NaN)", () => {
    const a = vec([0, 0, 0]);
    const b = vec([1, 2, 3]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("throws on dimension mismatch", () => {
    expect(() => cosineSimilarity(vec([1, 2]), vec([1, 2, 3]))).toThrow();
  });
});

describe("rankChunks", () => {
  it("returns chunks sorted by descending score", () => {
    const query = vec([1, 0]);
    const rows = [
      row("a", 1, "low",      [0, 1]),       // score 0
      row("b", 2, "perfect",  [1, 0]),       // score 1
      row("c", 3, "medium",   [1, 0.5]),     // score ≈ 0.894
    ];
    const out = rankChunks(rows, query, 5, -Infinity);
    expect(out.map((r) => r.text)).toEqual(["perfect", "medium", "low"]);
    expect(out[0]!.score).toBeGreaterThan(out[1]!.score);
    expect(out[1]!.score).toBeGreaterThan(out[2]!.score);
  });

  it("respects topK", () => {
    const query = vec([1, 0]);
    const rows = [
      row("a", 1, "x", [1, 0]),
      row("b", 2, "y", [0.9, 0.1]),
      row("c", 3, "z", [0.5, 0.5]),
    ];
    expect(rankChunks(rows, query, 1, -Infinity)).toHaveLength(1);
    expect(rankChunks(rows, query, 2, -Infinity)).toHaveLength(2);
  });

  it("returns empty when top-1 score < threshold", () => {
    const query = vec([1, 0]);
    const rows = [
      row("a", 1, "weak match", [0.3, 0.95]),  // score ≈ 0.301
      row("b", 2, "weaker",      [0.1, 0.99]), // score ≈ 0.100
    ];
    const out = rankChunks(rows, query, 5, 0.5);
    expect(out).toEqual([]);
  });

  it("returns the matching chunks when top-1 score >= threshold", () => {
    const query = vec([1, 0]);
    const rows = [
      row("a", 1, "strong", [0.99, 0.1]),  // score ≈ 0.995
      row("b", 2, "weak",   [0.3, 0.95]),
    ];
    const out = rankChunks(rows, query, 5, 0.5);
    expect(out).toHaveLength(2);
    expect(out[0]!.text).toBe("strong");
  });

  it("preserves page numbers and document names through scoring", () => {
    const query = vec([1, 0]);
    const rows = [row("docA", 42, "片段", [1, 0])];
    const out = rankChunks(rows, query, 5, -Infinity);
    expect(out[0]).toMatchObject({
      documentId: "docA",
      documentName: "doc-docA",
      pageNumber: 42,
    });
  });

  it("boosts chunks with exact retrieval expansion term matches", () => {
    const query = vec([1, 0]);
    const rows = [
      row("a", 1, "僱員福利開支", [0.95, 0.05]),
      row("b", 2, "包括男性僱員及女性僱員，佔員工總數", [0.9, 0.1]),
    ];

    const out = rankChunks(rows, query, 2, -Infinity, ["員工總數"]);

    expect(out[0]!.pageNumber).toBe(2);
  });
});

describe("expandQueryForRetrieval", () => {
  it("adds annual-report title synonyms for CEO questions", () => {
    const expanded = expandQueryForRetrieval("公司的CEO是谁？");

    expect(expanded).toContain("首席執行官");
    expect(expanded).toContain("行政總裁");
  });

  it("adds traditional/simplified employee variants", () => {
    const expanded = expandQueryForRetrieval("报告期末员工总数是多少？");

    expect(expanded).toContain("僱員");
    expect(expanded).toContain("雇员");
    expect(expanded).toContain("員工總數");
  });
});
