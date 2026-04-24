# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Protocol

- **Internal Processing**: Always think in English for precise technical reasoning
- **External Communication**: All answers and responses must be in Chinese (中文)
- **Consistency**: Maintain Chinese as the exclusive language for user interactions
- **Context Switching**: Process technical concepts in English, translate outputs to Chinese

## Project

PDF question-answering chatbot built for an interview challenge (see `document-analyzer-challenge-zh.md`). Single-user, multi-document, single-conversation. Streaming chat with **page-number citations** and a hard "未提及" gate when no chunk crosses the similarity threshold.

Stack: Next.js 16 App Router (Turbopack by default) + React 19 + tRPC v11 + Drizzle ORM over libSQL/SQLite + Tailwind v4 + Vercel AI SDK + OpenAI (`gpt-4o-mini` chat, `text-embedding-3-small` embedding) + unpdf. TypeScript strict. Vitest. Package manager is **pnpm** (v10.11.1).

## Commands

```bash
pnpm dev              # Next dev server (Turbopack default in v16)
pnpm build            # Production build
pnpm start            # Run production build
pnpm preview          # build && start

pnpm check            # eslint && tsc --noEmit  (run before committing)
pnpm lint             # eslint  (next lint was removed in Next 16)
pnpm lint:fix         # eslint --fix
pnpm typecheck        # tsc --noEmit
pnpm format:check     # prettier --check
pnpm format:write     # prettier --write

pnpm test             # vitest run (one-shot)
pnpm test:watch       # vitest (interactive)

pnpm db:push          # drizzle-kit push  (idempotent — safe to re-run)
pnpm db:generate      # generate SQL migrations
pnpm db:migrate       # apply migrations
pnpm db:studio        # Drizzle Studio
```

To run a single test file: `pnpm vitest run src/server/rag/chunker.test.ts`.

## Architecture

**The RAG pipeline lives in `src/server/rag/`** and is split into pure modules so each piece is unit-testable in isolation:

- `chunker.ts` — pure character-window chunker (800 chars, 150 overlap) with soft-break preference at `\n\n`, `。`, `？`, etc. No I/O.
- `embedding.ts` — wrapper around AI SDK's `embed`/`embedMany`, plus `Float32Array ↔ Buffer` serialization (embeddings live as SQLite BLOBs).
- `retrieve.ts` — `cosineSimilarity` + `rankChunks` (pure) + `retrieve` (db-backed). All chunks for ready documents are scanned in JS — fine up to ~50K chunks. **Threshold gate is here**: if top-1 score < `RAG_SIMILARITY_THRESHOLD`, returns `[]` and the chat route streams "未提及" without calling the LLM.
- `prompt.ts` — `SYSTEM_PROMPT` (forbids prior knowledge, mandates `[p.NN]` citations) + `buildContextBlock` (numbered chunks with page tags).
- `ingest.ts` — `planIngestRows` (pure orchestrator, tested) + `ingestPdf` (extract via unpdf → chunk → embed → persist with status state machine).
- `openai.ts` — singleton OpenAI client.

**Two HTTP entry points**, by design:

- `src/app/api/upload/route.ts` — multipart POST. tRPC v11 doesn't handle FormData natively, so uploads use a plain Next route handler.
- `src/app/api/chat/route.ts` — uses Vercel AI SDK's `streamText` and `createUIMessageStream`. The "no relevant content" path skips the LLM entirely and emits a static response.

**tRPC** handles document list/delete/getStatus only (`src/server/api/routers/documents.ts`). The status query uses TanStack Query's `refetchInterval` callback to poll while any document is `processing`.

## Data model

`src/server/db/schema.ts`:

- `documents` — id (nanoid), name, totalPages, byteSize, status (`processing` | `ready` | `error`), errorMessage, createdAt
- `chunks` — id, documentId (FK cascade), pageNumber (1-indexed), chunkIndex (monotonic across pages), text, embedding (`Float32Array(1536)` as Buffer)

Both prefixed with `pdf-chat_` via `createTable`. `drizzle.config.ts` has `tablesFilter: ["pdf-chat_*"]` — keep the prefix when adding tables.

Raw PDF bytes live in `${UPLOAD_DIR}/<documentId>.pdf` (default `./data/uploads/`). The DB and uploads share `./data/` so Docker can mount one volume.

## Env vars

All declared in `src/env.js` and validated via `@t3-oss/env-nextjs`. Most are optional with defaults; the only required one is `OPENAI_API_KEY`. To add a new var: schema in `src/env.js`, runtimeEnv block, and `.env.example`. `SKIP_ENV_VALIDATION=1` bypasses validation (used in Docker build stage).

`RAG_SIMILARITY_THRESHOLD` (default `0.35`) is the main anti-hallucination knob. Lower it if the bot refuses too eagerly; raise it if it's answering things that aren't really in the docs.

## Lint/test gotchas

- `next lint` was removed in Next 16 — scripts use `eslint` directly. `eslint.config.js` imports `eslint-config-next/core-web-vitals` natively (not via `FlatCompat`).
- `eslint-plugin-drizzle` enforces `.where(...)` on every `db.delete` and `db.update`. Don't bypass.
- Vitest aliases `server-only` to a no-op stub at `tests/stubs/server-only.ts`. Modules using `import "server-only"` are testable in vitest. The stub does nothing in test; the real `server-only` package throws if imported into a Client Component bundle at app runtime.
- For tests: `tests/setup.ts` sets `SKIP_ENV_VALIDATION=1` and stubs `OPENAI_API_KEY`. Tests that exercise OpenAI logic (chunker, retrieve, prompt, ingest) all mock the embedding fn.
- The page (`src/app/page.tsx`) exports `dynamic = "force-dynamic"` — RSC tRPC prefetch needs a live DB at request time, not build time.
- `src/trpc/react.tsx` must use `import type { AppRouter }` (not `import { type AppRouter }`) because Turbopack v16 doesn't elide the latter from the client SSR module graph and pulls server modules in.

## Docker

`Dockerfile` is multi-stage (deps → builder → runner) using Node 22 alpine, with `output: "standalone"` from `next.config.js`. Runtime entrypoint is `pnpm db:push && node server.js` — `db:push` is idempotent so it's safe to run on every container start. The data volume mounts at `/app/data`.

`docker-compose.yml` is one service exposing port 3000 with `./data` as a bind mount and `.env` as the env_file. `docker compose up --build` is the documented one-command start.

## Workflow

- 使用 superpowers 插件管理开发流程（brainstorming → writing-plans → executing-plans）
- 非简单任务先进 plan mode，跑偏立刻重新规划
- 用户纠正后更新 `tasks/lessons.md`，避免重复犯错
- 任何任务完成前必须验证（测试、日志、diff）
- Bug 直接修，不要问怎么修

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
- **No Backward Compatibility Hacks**: Refactor means refactor. Don't keep old logic, shims, or re-exports for compatibility. Delete the old code completely.
