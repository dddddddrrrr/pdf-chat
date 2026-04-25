# PDF Chat

A grounded document-question-answering chatbot. Upload PDFs, ask questions in any language, get answers with **page-number citations** that come straight from the document — and an honest "未提及" / "not in the document" when the answer isn't there.

Built for the [Document Analyzer Challenge](./document-analyzer-challenge-zh.md). Demonstrated on the Tencent 2025 Annual Report (Chinese, ~200+ pages).

---

## Quick start (Docker)

```bash
cp .env.example .env
# Edit .env — paste your OpenAI API key into OPENAI_API_KEY
docker compose up --build
```

Open <http://localhost:3000>, click **选择或拖入 PDF**, upload `腾讯2025年度报告.pdf`, wait for the status badge to flip from **PROCESSING** to **READY** (≈30–60 s for a 200-page report — embedding is the bottleneck), then ask away.

The SQLite database and uploaded PDFs live in `./data/` and survive `docker compose down && up`.

## Quick start (local node)

```bash
cp .env.example .env  # then paste your OPENAI_API_KEY
pnpm install
pnpm db:push          # creates ./data/db.sqlite
pnpm dev              # http://localhost:3000
```

Requires Node ≥ 22 and pnpm. Tested with pnpm 10.11.

---

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | *(required)* | Used for both chat and embeddings |
| `OPENAI_BASE_URL` | OpenAI default | Override for OpenAI-compatible providers (DeepSeek, Moonshot, etc.) |
| `RAG_CHAT_MODEL` | `gpt-4o-mini` | Chat completion model |
| `RAG_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model (1536 dim) |
| `RAG_TOP_K` | `6` | How many chunks to feed the LLM per question |
| `RAG_SIMILARITY_THRESHOLD` | `0.35` | Below this cosine score, the bot returns "未提及" without calling the LLM. **This is the main anti-hallucination knob.** |
| `DATABASE_URL` | `file:./data/db.sqlite` | libSQL / SQLite path |
| `UPLOAD_DIR` | `./data/uploads` | Where raw PDFs are persisted |

---

## Retrieval strategy (3–5 sentences)

PDFs are extracted page-by-page with [`unpdf`](https://github.com/unjs/unpdf) (a serverless build of pdf.js — pure JS, no native deps), then chunked at **800 characters** with **150-character overlap**, preferring soft breaks at `\n\n`, `。`, `？`, `！` so that Chinese sentences aren't sliced mid-word. Each chunk is embedded with **OpenAI `text-embedding-3-small`** (1536 dim, ≈$0.02/1M tokens) and stored as a `Float32Array` BLOB in SQLite alongside its page number — that's the entire vector store. At query time we cosine-rank all chunks for the question's embedding in plain Node (≈100 ms even for thousands of chunks), gate the top-1 against a **0.35 similarity threshold** to refuse out-of-document questions before the LLM is ever called, then feed the top-6 chunks as numbered, page-tagged context to **`gpt-4o-mini`** with a system prompt that mandates inline `[p.NN]` citations and forbids prior-knowledge answers. There is no rerank step.

---

## What this is — and what it isn't

### Tradeoffs (the things you'll notice)

- **No reranking.** Top-k cosine is the final selection. Good enough for a 200-page report; might drop precision on a 10K-page corpus.
- **In-process vector search.** The whole `chunks` table is read on every query and scored in JS. Fine up to maybe 50K chunks (≈300 MB / <500 ms on commodity hardware). Beyond that, switch to `sqlite-vec` or `pgvector`.
- **Tables aren't parsed.** unpdf reads tables row-by-row in source order. Numerical answers from financial tables work; multi-column comparison tables sometimes look funky in retrieved chunks. The challenge brief explicitly says perfect table parsing is not required.
- **Chunks live forever.** No re-indexing if the embedding model changes. To re-embed, delete the document and re-upload.
- **One-shot LLM call per turn.** No tool use, no agentic loops. The model gets the context and writes the answer. Streaming is via the Vercel AI SDK.
- **No auth, single user.** Anyone hitting the URL sees and edits the same documents.

### Anti-hallucination is enforced two ways

1. **Hard gate before the LLM:** if the top-1 retrieved chunk scores below `RAG_SIMILARITY_THRESHOLD`, the route returns the literal string "文档中未提及相关内容。" without ever calling the model. This is provably faithful — the LLM cannot invent context it never saw.
2. **Strict system prompt:** when context *is* passed, the prompt forbids using prior knowledge, mandates `[p.NN]` citations, and instructs the model to refuse comparison/calculation when only one of the required data points appears in context.

### If I had more time

- **Cross-encoder rerank** (e.g. `bge-reranker-v2-m3`) on the top-20 → top-6 — biggest single quality win for ranked retrieval.
- **Hover-to-preview citations:** clicking `[p.42]` should pop a panel with the source paragraph + a deep link into the rendered PDF.
- **Per-document scoping** in the UI — checkboxes to constrain answers to a subset of uploaded docs.
- **Streaming ingest progress** (page-by-page extract → chunk → embed → write) instead of the current 3-state poll.
- **Adaptive chunk size** based on document type (financial tables need bigger windows than prose).
- **Eval harness** — a small CSV of question/expected-citation pairs run nightly to catch regressions across model/threshold changes.

---

## Architecture

```
Browser ──┬── Upload (multipart)  ──► /api/upload  ──► ingestPdf() ──► SQLite (documents + chunks)
          ├── tRPC (list/delete/getStatus) ────────► /api/trpc/[trpc]
          └── Chat (useChat / SSE) ──► /api/chat ──► retrieve() ──► (threshold gate) ──► streamText(gpt-4o-mini)
```

Key modules in `src/server/rag/`:

| File | Purpose |
|---|---|
| `chunker.ts` | Pure character-window chunker with soft-break preference. Tested. |
| `embedding.ts` | OpenAI embedding wrapper + `Float32Array ↔ Buffer` serialization. Tested. |
| `retrieve.ts` | Cosine ranking + threshold gate. Tested. |
| `prompt.ts` | System prompt + CONTEXT block builder. Tested. |
| `ingest.ts` | Extract → chunk → embed → persist. Pure planning function tested. |

---

## Tests

```bash
pnpm test          # one-shot
pnpm test:watch    # interactive
pnpm check         # eslint + tsc --noEmit
```

58 tests across 12 files cover the failure modes most likely to silently regress: chunker boundary handling, cosine math + threshold gate, prompt invariants, ingest orchestration, embedding round-trip, chat route response shaping, and standalone PDF extraction assets. UI and the streaming chat route are verified manually (see screenshots) — see `docs/screenshots/`.

---

## Tech stack

- **Next.js 16** App Router (Turbopack default)
- **React 19**
- **tRPC v11** for typed list/delete/status procedures
- **Drizzle ORM** + **libSQL/SQLite** for documents + chunks (and embedding BLOBs)
- **Vercel AI SDK** (`ai` + `@ai-sdk/openai` + `@ai-sdk/react`) for streaming chat
- **unpdf** for PDF extraction
- **Tailwind v4** for UI
- **Vitest** for tests

---

## License

For interview review only.
