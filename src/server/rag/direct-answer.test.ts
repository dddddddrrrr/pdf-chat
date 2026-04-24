import { describe, expect, test } from "vitest";

import { answerDirectlyFromContext } from "./direct-answer";
import { type RetrievedChunk } from "./retrieve";

function chunk(text: string): RetrievedChunk {
  return {
    documentId: "doc",
    documentName: "annual-report.pdf",
    pageNumber: 99,
    chunkIndex: 0,
    text,
    score: 1,
  };
}

describe("answerDirectlyFromContext", () => {
  test("computes employee total from male and female employee counts", () => {
    const answer = answerDirectlyFromContext("报告期末员工总数是多少？", [
      chunk(
        "包括 58,812 名男性僱員及 28,600 名女性\n僱員，分別佔員工總數約 67.3% 及 32.7%。",
      ),
    ]);

    expect(answer).toBe("报告期末员工总数为 87,412 人 [p.99]。");
  });

  test("does not answer unrelated questions", () => {
    const answer = answerDirectlyFromContext("总收入是多少？", [
      chunk("收入 751,766"),
    ]);

    expect(answer).toBeNull();
  });
});
