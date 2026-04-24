export interface ChunkResult {
  pageNumber: number;
  chunkIndex: number;
  text: string;
}

export interface ChunkerOptions {
  chunkSize?: number;
  overlap?: number;
}

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 150;
const SOFT_BREAKS = ["\n\n", "\n", "。", "？", "！", "；", ".", "?", "!", ";"];
const LOOKBACK_WINDOW = 200;

export function normalizeText(raw: string): string {
  return raw.replace(/[ \t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function chunkPage(
  pageText: string,
  pageNumber: number,
  startIndex = 0,
  opts: ChunkerOptions = {},
): ChunkResult[] {
  const size = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = opts.overlap ?? DEFAULT_OVERLAP;
  if (size <= overlap) {
    throw new Error("chunkSize must be greater than overlap");
  }

  const text = normalizeText(pageText);
  if (text.length === 0) return [];

  const out: ChunkResult[] = [];
  let pos = 0;
  let idx = startIndex;

  while (pos < text.length) {
    let end = Math.min(pos + size, text.length);

    if (end < text.length) {
      const lookbackStart = Math.max(end - LOOKBACK_WINDOW, pos + Math.floor(size / 2));
      const slice = text.substring(lookbackStart, end);
      let bestBreak = -1;
      for (const br of SOFT_BREAKS) {
        const i = slice.lastIndexOf(br);
        if (i > bestBreak) bestBreak = i + br.length;
      }
      if (bestBreak > 0) {
        end = lookbackStart + bestBreak;
      }
    }

    const chunkText = text.substring(pos, end).trim();
    if (chunkText.length > 0) {
      out.push({ pageNumber, chunkIndex: idx, text: chunkText });
      idx += 1;
    }

    if (end >= text.length) break;
    const nextPos = end - overlap;
    pos = nextPos > pos ? nextPos : pos + 1;
  }

  return out;
}

export function chunkPages(
  pages: string[],
  opts: ChunkerOptions = {},
): ChunkResult[] {
  const out: ChunkResult[] = [];
  let runningIndex = 0;
  pages.forEach((pageText, i) => {
    const pageNumber = i + 1;
    const chunks = chunkPage(pageText, pageNumber, runningIndex, opts);
    out.push(...chunks);
    runningIndex += chunks.length;
  });
  return out;
}
