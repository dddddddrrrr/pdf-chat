import "server-only";
import { eq, inArray } from "drizzle-orm";

import { env } from "~/env";
import { db } from "~/server/db";
import { chunks, documents } from "~/server/db/schema";

import { bufferToEmbedding, embedQuery } from "./embedding";

export interface RetrievedChunk {
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  score: number;
}

export interface RetrieveOptions {
  topK?: number;
  threshold?: number;
  documentIds?: string[];
}

const QUERY_EXPANSIONS = [
  {
    pattern: /\bceo\b|首席执行官|首席執行官|行政总裁|行政總裁/i,
    terms: ["首席執行官", "首席执行官", "行政總裁", "行政总裁"],
  },
  {
    pattern: /员工|僱員|雇员|雇員|employee|employees/i,
    terms: ["員工", "员工", "僱員", "雇員", "雇员", "員工總數", "僱員總數"],
  },
] as const;

function lexicalBoost(text: string, terms: string[]): number {
  if (terms.length === 0) return 0;
  const uniqueTerms = [...new Set(terms.filter((term) => term.length > 0))];
  const matches = uniqueTerms.filter((term) => text.includes(term)).length;
  return Math.min(matches * 0.12, 0.3);
}

function expansionTermsForQuery(query: string): string[] {
  return QUERY_EXPANSIONS.flatMap(({ pattern, terms }) =>
    pattern.test(query) ? terms : [],
  );
}

export function expandQueryForRetrieval(query: string): string {
  const additions = expansionTermsForQuery(query);
  if (additions.length === 0) return query;
  return `${query}\n${[...new Set(additions)].join(" ")}`;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export interface ScoredRow {
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  embedding: Buffer;
}

export function rankChunks(
  rows: ScoredRow[],
  queryEmbedding: Float32Array,
  topK: number,
  threshold: number,
  lexicalTerms: string[] = [],
): RetrievedChunk[] {
  const scored = rows.map((r) => ({
    documentId: r.documentId,
    documentName: r.documentName,
    pageNumber: r.pageNumber,
    chunkIndex: r.chunkIndex,
    text: r.text,
    score:
      cosineSimilarity(queryEmbedding, bufferToEmbedding(r.embedding)) +
      lexicalBoost(r.text, lexicalTerms),
  }));

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topK);

  if (top.length === 0 || top[0]!.score < threshold) return [];
  return top;
}

export async function retrieve(
  query: string,
  opts: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  const topK = opts.topK ?? env.RAG_TOP_K;
  const threshold = opts.threshold ?? env.RAG_SIMILARITY_THRESHOLD;

  const baseQuery = db
    .select({
      documentId: chunks.documentId,
      documentName: documents.name,
      pageNumber: chunks.pageNumber,
      chunkIndex: chunks.chunkIndex,
      text: chunks.text,
      embedding: chunks.embedding,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id));

  const whereClause =
    opts.documentIds && opts.documentIds.length > 0
      ? inArray(documents.id, opts.documentIds)
      : eq(documents.status, "ready");

  const rows = await baseQuery.where(whereClause);
  if (rows.length === 0) return [];

  const queryVec = new Float32Array(await embedQuery(expandQueryForRetrieval(query)));
  return rankChunks(rows, queryVec, topK, threshold, expansionTermsForQuery(query));
}
