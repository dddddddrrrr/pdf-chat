import { describe, expect, it } from "vitest";

import { chunkPage, chunkPages, normalizeText } from "./chunker";

describe("normalizeText", () => {
  it("collapses runs of spaces and tabs", () => {
    expect(normalizeText("a   b\t\tc")).toBe("a b c");
  });

  it("preserves paragraph breaks", () => {
    expect(normalizeText("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeText("  hello  ")).toBe("hello");
  });
});

describe("chunkPage", () => {
  it("returns empty array for empty page", () => {
    expect(chunkPage("", 1)).toEqual([]);
    expect(chunkPage("   \n\n  ", 1)).toEqual([]);
  });

  it("returns one chunk when text fits in chunkSize", () => {
    const text = "短文本，一个 chunk 装得下。";
    const chunks = chunkPage(text, 5);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ pageNumber: 5, chunkIndex: 0, text });
  });

  it("propagates pageNumber and starting chunkIndex", () => {
    const text = "abc";
    const chunks = chunkPage(text, 42, 7);
    expect(chunks[0]?.pageNumber).toBe(42);
    expect(chunks[0]?.chunkIndex).toBe(7);
  });

  it("breaks long text into overlapping chunks", () => {
    const text = "a".repeat(2000);
    const chunks = chunkPage(text, 1, 0, { chunkSize: 500, overlap: 100 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.text.length).toBeLessThanOrEqual(500);
    // chunk indices monotonic
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i]!.chunkIndex).toBe(chunks[i - 1]!.chunkIndex + 1);
    }
  });

  it("does not duplicate text beyond the configured overlap", () => {
    const a = "段落一，结束于第一个句号。";
    const b = "段落二，结束于第二个句号。";
    const c = "段落三，结束于第三个句号。";
    const text = a.repeat(20) + b.repeat(20) + c.repeat(20);
    const chunks = chunkPage(text, 1, 0, { chunkSize: 200, overlap: 50 });
    // Re-assemble (de-overlapped) total length should be at most original length
    let assembled = chunks[0]!.text;
    for (let i = 1; i < chunks.length; i++) {
      // strip up-to overlap chars from the start of subsequent chunks
      assembled += chunks[i]!.text.substring(50);
    }
    expect(assembled.length).toBeLessThanOrEqual(text.length + chunks.length); // tolerance for trim
  });

  it("prefers Chinese sentence terminators as soft breaks", () => {
    const sentence = "这是第一个句子。这是第二个句子。这是第三个句子。";
    const text = sentence.repeat(10);
    const chunks = chunkPage(text, 1, 0, { chunkSize: 80, overlap: 20 });
    // Most chunks should end with a Chinese full stop (give-or-take whitespace)
    const endsWithStop = chunks.filter((c) => c.text.trimEnd().endsWith("。"));
    expect(endsWithStop.length).toBeGreaterThan(chunks.length / 2);
  });

  it("hard-cuts continuous text without breaks (no infinite loop)", () => {
    const text = "无标点中文连续文字".repeat(200);
    const chunks = chunkPage(text, 1, 0, { chunkSize: 200, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThan(50); // sanity: doesn't explode
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(200);
  });

  it("throws when overlap >= chunkSize", () => {
    expect(() => chunkPage("hello", 1, 0, { chunkSize: 100, overlap: 100 })).toThrow();
    expect(() => chunkPage("hello", 1, 0, { chunkSize: 50, overlap: 100 })).toThrow();
  });
});

describe("chunkPages", () => {
  it("assigns increasing chunkIndex across pages", () => {
    const longPage = "句子。".repeat(300);
    const chunks = chunkPages([longPage, longPage, longPage], { chunkSize: 200, overlap: 50 });
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i]!.chunkIndex).toBe(chunks[i - 1]!.chunkIndex + 1);
    }
  });

  it("preserves page numbers (1-indexed)", () => {
    const chunks = chunkPages(["page one", "page two", "page three"]);
    expect(chunks.map((c) => c.pageNumber)).toEqual([1, 2, 3]);
  });

  it("skips empty pages", () => {
    const chunks = chunkPages(["text", "", "more text"]);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.pageNumber).toBe(1);
    expect(chunks[1]!.pageNumber).toBe(3);
  });
});
