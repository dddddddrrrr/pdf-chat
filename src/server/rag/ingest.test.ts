import { describe, expect, it, vi } from "vitest";

import { bufferToEmbedding } from "./embedding";
import { planIngestRows } from "./ingest";

describe("planIngestRows", () => {
  it("turns multi-page text into chunks with correct page numbers", async () => {
    const pages = [
      "第一页内容。" + "腾讯控股。".repeat(50),
      "第二页内容。" + "公司业务。".repeat(50),
      "第三页内容。" + "财务数据。".repeat(50),
    ];
    const embedTexts = vi
      .fn<(texts: string[]) => Promise<number[][]>>()
      .mockImplementation(async (texts) =>
        texts.map((_, i) => [i / texts.length, 0.5, 0.5]),
      );

    const rows = await planIngestRows(pages, "doc-abc", embedTexts);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const pageNums = new Set(rows.map((r) => r.pageNumber));
    expect(pageNums).toEqual(new Set([1, 2, 3]));
    for (const r of rows) {
      expect(r.documentId).toBe("doc-abc");
      expect(r.text.length).toBeGreaterThan(0);
    }
  });

  it("calls embedTexts exactly once with all chunk texts", async () => {
    const pages = ["短页面一", "短页面二"];
    const embedTexts = vi
      .fn<(texts: string[]) => Promise<number[][]>>()
      .mockImplementation(async (texts) => texts.map(() => [1, 0]));

    const rows = await planIngestRows(pages, "d", embedTexts);
    expect(embedTexts).toHaveBeenCalledTimes(1);
    expect(embedTexts.mock.calls[0]?.[0]).toHaveLength(rows.length);
  });

  it("preserves embedding vectors verbatim into the row buffers", async () => {
    const pages = ["唯一页"];
    const expectedVec = [0.1, 0.2, 0.3, 0.4, 0.5];
    const embedTexts = vi
      .fn<(texts: string[]) => Promise<number[][]>>()
      .mockResolvedValue([expectedVec]);

    const rows = await planIngestRows(pages, "d", embedTexts);
    expect(rows).toHaveLength(1);
    const restored = bufferToEmbedding(rows[0]!.embedding);
    for (let i = 0; i < expectedVec.length; i++) {
      expect(restored[i]).toBeCloseTo(expectedVec[i]!, 5);
    }
  });

  it("throws when PDF has no extractable text", async () => {
    const embedTexts = vi.fn<(texts: string[]) => Promise<number[][]>>();
    await expect(
      planIngestRows(["", "   ", "\n\n"], "d", embedTexts),
    ).rejects.toThrow(/no extractable text/);
    expect(embedTexts).not.toHaveBeenCalled();
  });

  it("throws when embedding count doesn't match chunk count", async () => {
    const pages = ["页面一", "页面二", "页面三"];
    const embedTexts = vi
      .fn<(texts: string[]) => Promise<number[][]>>()
      .mockResolvedValue([[1, 0]]); // wrong count
    await expect(planIngestRows(pages, "d", embedTexts)).rejects.toThrow(
      /embedding count/,
    );
  });

  it("assigns globally-monotonic chunkIndex across pages", async () => {
    const longPage = "句子。".repeat(300);
    const pages = [longPage, longPage, longPage];
    const embedTexts = vi
      .fn<(texts: string[]) => Promise<number[][]>>()
      .mockImplementation(async (texts) => texts.map(() => [0.1, 0.2]));
    const rows = await planIngestRows(pages, "d", embedTexts);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.chunkIndex).toBe(rows[i - 1]!.chunkIndex + 1);
    }
  });
});
