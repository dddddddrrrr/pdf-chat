import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { answerDirectlyFromContext } from "~/server/rag/direct-answer";
import { chatModel } from "~/server/rag/openai";
import {
  buildUserPromptWithContext,
  NO_CONTEXT_FALLBACK,
  SYSTEM_PROMPT,
} from "~/server/rag/prompt";
import { retrieve, type RetrievedChunk } from "~/server/rag/retrieve";

export const runtime = "nodejs";
export const maxDuration = 60;

const chatPayloadSchema = z.object({
  messages: z.array(z.custom<UIMessage>()).optional(),
  documentIds: z.array(z.string().trim().min(1)).min(1).max(100),
});

const CITATION_PATTERN = /\[p\.(\d+(?:\s*,\s*\d+)*)\]/g;

interface CitationSource {
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  snippet: string;
}

function extractLatestUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "user") continue;
    const parts = m.parts ?? [];
    return parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n")
      .trim();
  }
  return "";
}

function uniqueDocumentIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function buildCitationSources(chunks: RetrievedChunk[]): CitationSource[] {
  const seen = new Set<string>();
  const sources: CitationSource[] = [];

  for (const chunk of chunks) {
    const key = `${chunk.documentId}:${chunk.pageNumber}:${chunk.chunkIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      pageNumber: chunk.pageNumber,
      chunkIndex: chunk.chunkIndex,
      snippet: chunk.text.replace(/\s+/g, " ").slice(0, 240),
    });
  }

  return sources;
}

function uniquePages(citations: CitationSource[]): number[] {
  return [...new Set(citations.map((c) => c.pageNumber))];
}

function formatPageMarkers(pages: number[]): string {
  return pages.map((page) => `[p.${page}]`).join("");
}

function extractCitationPages(text: string): number[] {
  const pages: number[] = [];
  for (const match of text.matchAll(CITATION_PATTERN)) {
    pages.push(
      ...match[1]!
        .split(",")
        .map((page) => Number.parseInt(page.trim(), 10))
        .filter((page) => Number.isInteger(page)),
    );
  }
  return pages;
}

function sanitizeCitationMarkers(
  text: string,
  allowedPages: Set<number>,
): string {
  return text
    .replace(CITATION_PATTERN, (_match, pageList: string) => {
      const pages = pageList
        .split(",")
        .map((page) => Number.parseInt(page.trim(), 10))
        .filter((page) => allowedPages.has(page));
      return formatPageMarkers([...new Set(pages)]);
    })
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function ensureAnswerCitations(
  text: string,
  citations: CitationSource[],
): string {
  const trimmed = text.trim();
  if (!trimmed || trimmed.includes("文档中未提及")) return trimmed;

  const pages = uniquePages(citations);
  if (pages.length === 0) return trimmed;

  const allowedPages = new Set(pages);
  const sanitized = sanitizeCitationMarkers(trimmed, allowedPages);
  const hasAllowedCitation = extractCitationPages(sanitized).some((page) =>
    allowedPages.has(page),
  );

  if (hasAllowedCitation) return sanitized;

  return `${sanitized}\n\n来源：${formatPageMarkers(pages)}`;
}

function textStreamResponse(text: string, citations: CitationSource[] = []) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute({ writer }) {
        const id = "answer";
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: text });
        writer.write({ type: "text-end", id });
        if (citations.length > 0) {
          writer.write({
            type: "data-citations",
            id: "citations",
            data: citations,
          });
        }
      },
    }),
  });
}

export async function POST(req: Request) {
  let rawPayload: unknown;
  try {
    rawPayload = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const parsed = chatPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return new Response("Missing or invalid documentIds", { status: 400 });
  }

  const payload = parsed.data;
  const messages = payload.messages ?? [];
  const query = extractLatestUserText(messages);
  if (!query) {
    return new Response("Missing user message", { status: 400 });
  }

  const documentIds = uniqueDocumentIds(payload.documentIds);
  if (documentIds.length === 0) {
    return new Response("Missing or invalid documentIds", { status: 400 });
  }

  const retrieved = await retrieve(query, { documentIds });

  if (retrieved.length === 0) {
    return textStreamResponse(NO_CONTEXT_FALLBACK);
  }

  const directAnswer = answerDirectlyFromContext(query, retrieved);
  if (directAnswer) {
    const citedPages = new Set(extractCitationPages(directAnswer));
    const directCitations = buildCitationSources(retrieved).filter((citation) =>
      citedPages.has(citation.pageNumber),
    );
    return textStreamResponse(directAnswer, directCitations);
  }

  const modelMessages = await convertToModelMessages(messages);
  const citations = buildCitationSources(retrieved);

  // Replace the final user message with the context-augmented version.
  const augmented = buildUserPromptWithContext(
    query,
    retrieved.map((c) => ({
      pageNumber: c.pageNumber,
      text: c.text,
      documentName: c.documentName,
    })),
  );
  for (let i = modelMessages.length - 1; i >= 0; i--) {
    if (modelMessages[i]?.role === "user") {
      modelMessages[i] = { role: "user", content: augmented };
      break;
    }
  }

  const result = streamText({
    model: chatModel(),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    temperature: 0.1,
  });

  const answer = ensureAnswerCitations(await result.text, citations);
  return textStreamResponse(answer, citations);
}
