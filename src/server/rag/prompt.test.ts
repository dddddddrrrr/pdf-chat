import { describe, expect, it } from "vitest";

import {
  buildContextBlock,
  buildUserPromptWithContext,
  NO_CONTEXT_FALLBACK,
  SYSTEM_PROMPT,
} from "./prompt";

describe("SYSTEM_PROMPT", () => {
  it("instructs the model to refuse outside-context answers", () => {
    expect(SYSTEM_PROMPT).toContain("文档中未提及");
    expect(SYSTEM_PROMPT).toMatch(/不能.*先验|prior knowledge/);
  });

  it("requires bracketed page citations", () => {
    expect(SYSTEM_PROMPT).toContain("[p.");
    expect(SYSTEM_PROMPT).toMatch(/引用|citation/);
  });

  it("mentions the comparison/calculation rule", () => {
    expect(SYSTEM_PROMPT).toMatch(/比较|计算|两个时点/);
  });

  it("allows simple totals when all components are in context", () => {
    expect(SYSTEM_PROMPT).toMatch(/加总|相加|组件/);
  });
});

describe("buildContextBlock", () => {
  it("emits the empty marker when no chunks", () => {
    const block = buildContextBlock([]);
    expect(block).toContain("无相关内容");
    expect(block).toContain("<CONTEXT>");
    expect(block).toContain("</CONTEXT>");
  });

  it("emits one labelled entry per chunk with page number", () => {
    const block = buildContextBlock([
      { pageNumber: 3, text: "腾讯2025年总收入为人民币X元" },
      { pageNumber: 47, text: "公司CEO为马化腾先生" },
    ]);
    expect(block).toContain("[1] (p.3)");
    expect(block).toContain("[2] (p.47)");
    expect(block).toContain("腾讯2025年总收入");
    expect(block).toContain("CEO为马化腾");
  });

  it("includes document name when provided", () => {
    const block = buildContextBlock([
      { pageNumber: 3, text: "片段", documentName: "Annual Report" },
    ]);
    expect(block).toContain("《Annual Report》");
  });
});

describe("buildUserPromptWithContext", () => {
  it("prepends context block before the question", () => {
    const out = buildUserPromptWithContext("总收入是多少？", [
      { pageNumber: 3, text: "总收入为X" },
    ]);
    const ctxIdx = out.indexOf("<CONTEXT>");
    const qIdx = out.indexOf("总收入是多少？");
    expect(ctxIdx).toBeGreaterThanOrEqual(0);
    expect(qIdx).toBeGreaterThan(ctxIdx);
  });

  it("escapes nothing — chunks are passed through verbatim", () => {
    const tricky = "包含 < 和 > 和 [p.1] 标记的片段";
    const out = buildUserPromptWithContext("?", [
      { pageNumber: 1, text: tricky },
    ]);
    expect(out).toContain(tricky);
  });
});

describe("NO_CONTEXT_FALLBACK", () => {
  it("is a non-empty Chinese sentence", () => {
    expect(NO_CONTEXT_FALLBACK.length).toBeGreaterThan(0);
    expect(NO_CONTEXT_FALLBACK).toContain("文档中未提及");
  });
});
