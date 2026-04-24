import "server-only";
import "~/server/runtime/promise-try";

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { extractText, getDocumentProxy } from "unpdf";

import { db } from "~/server/db";
import { chunks, documents, type NewChunk } from "~/server/db/schema";

import { chunkPages } from "./chunker";
import { embedBatch, embeddingToBuffer } from "./embedding";
import { pdfjsDocumentOptions } from "./pdfjs-options";

export interface IngestResult {
  documentId: string;
  totalPages: number;
  chunkCount: number;
}

const DB_BATCH_SIZE = 200;

/**
 * Pure orchestration: takes extracted page texts + an embedding fn,
 * returns the rows to insert. Easy to unit test without unpdf or OpenAI.
 */
export async function planIngestRows(
  pageTexts: string[],
  documentId: string,
  embedTexts: (texts: string[]) => Promise<number[][]>,
): Promise<NewChunk[]> {
  const chunked = chunkPages(pageTexts);
  if (chunked.length === 0) {
    throw new Error("PDF contains no extractable text");
  }
  const vectors = await embedTexts(chunked.map((c) => c.text));
  if (vectors.length !== chunked.length) {
    throw new Error(
      `embedding count (${vectors.length}) != chunk count (${chunked.length})`,
    );
  }
  return chunked.map((c, i) => ({
    documentId,
    pageNumber: c.pageNumber,
    chunkIndex: c.chunkIndex,
    text: c.text,
    embedding: embeddingToBuffer(vectors[i]!),
  }));
}

/**
 * Full ingest path: PDF buffer → extract → plan rows → persist.
 *
 * The unpdf + DB I/O parts are verified end-to-end by the Tencent annual
 * report run in step 8 of the implementation plan. The chunk/embed/serialize
 * orchestration is unit-tested via planIngestRows.
 */
export async function ingestPdf(
  pdfBuffer: Uint8Array,
  fileName: string,
  byteSize: number,
): Promise<IngestResult> {
  const id = nanoid();

  await db.insert(documents).values({
    id,
    name: fileName,
    byteSize,
    status: "processing",
  });

  try {
    const pdf = await getDocumentProxy(pdfBuffer, pdfjsDocumentOptions());
    const { totalPages, text: pages } = await extractText(pdf);

    const rows = await planIngestRows(pages, id, embedBatch);

    for (let i = 0; i < rows.length; i += DB_BATCH_SIZE) {
      await db.insert(chunks).values(rows.slice(i, i + DB_BATCH_SIZE));
    }

    await db
      .update(documents)
      .set({ totalPages, status: "ready" })
      .where(eq(documents.id, id));

    return { documentId: id, totalPages, chunkCount: rows.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(documents)
      .set({ status: "error", errorMessage: msg })
      .where(eq(documents.id, id));
    throw err;
  }
}
