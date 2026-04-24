import { type RetrievedChunk } from "./retrieve";

const EMPLOYEE_TOTAL_QUERY = /员工|員工|僱員|雇员|employee/i;
const TOTAL_QUERY = /总数|總數|多少|how many|number/i;
const EMPLOYEE_GENDER_COUNTS =
  /([\d,]+)\s*名男性\s*[僱雇]員及\s*([\d,]+)\s*名女性\s*[僱雇]員/;

function parseInteger(value: string): number {
  return Number.parseInt(value.replaceAll(",", ""), 10);
}

export function answerDirectlyFromContext(
  query: string,
  chunks: RetrievedChunk[],
): string | null {
  if (!EMPLOYEE_TOTAL_QUERY.test(query) || !TOTAL_QUERY.test(query)) {
    return null;
  }

  for (const chunk of chunks) {
    const match = EMPLOYEE_GENDER_COUNTS.exec(chunk.text);
    if (!match) continue;

    const male = parseInteger(match[1]!);
    const female = parseInteger(match[2]!);
    if (!Number.isFinite(male) || !Number.isFinite(female)) continue;

    return `报告期末员工总数为 ${(male + female).toLocaleString("en-US")} 人 [p.${chunk.pageNumber}]。`;
  }

  return null;
}
