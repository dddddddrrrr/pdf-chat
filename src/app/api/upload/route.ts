import { type NextRequest, NextResponse } from "next/server";

import { splitPdfBytes } from "~/server/rag/pdf-bytes";
import { ingestPdf } from "~/server/rag/ingest";
import { savePdf } from "~/server/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing 'file' field in multipart body" },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_BYTES / 1024 / 1024} MB.` },
        { status: 413 },
      );
    }

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf") && file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are accepted" },
        { status: 415 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { ingestBytes, storageBytes } = splitPdfBytes(bytes);

    // pdf.js may transfer the ingest buffer, so storage uses an independent copy.
    // Order matters: ingest first creates the document id used as the filename.
    const result = await ingestPdf(ingestBytes, file.name, file.size);
    await savePdf(result.documentId, storageBytes);

    return NextResponse.json({
      ok: true,
      documentId: result.documentId,
      totalPages: result.totalPages,
      chunkCount: result.chunkCount,
    });
  } catch (err) {
    console.error("upload failed", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
