# Repository Guidelines

## Project Structure & Module Organization

This repo implements a PDF question-answering chatbot for an interview challenge (`document-analyzer-challenge-zh.md`). Core layout:

- `src/app/` — Next.js 16 App Router. `layout.tsx`, `page.tsx`, route handlers under `api/` (`api/chat`, `api/upload`, `api/trpc/[trpc]`). Client components in `_components/` (upload-panel, document-list, chat-panel, citation).
- `src/server/rag/` — RAG pipeline split into pure modules: `chunker`, `embedding`, `retrieve`, `prompt`, `ingest`, `openai`. Each `*.ts` has a colocated `*.test.ts`.
- `src/server/api/routers/` — tRPC procedures (`documents.ts` only — list/delete/getStatus). Root in `src/server/api/root.ts`. Helpers in `src/trpc/`.
- `src/server/db/` — Drizzle schema (`documents` + `chunks`) and libSQL client.
- `src/server/storage.ts` — filesystem persistence for raw PDFs.
- `tests/` — vitest config (`setup.ts`, `stubs/server-only.ts`).
- `data/` — runtime SQLite + uploaded PDFs (gitignored). Mounted as Docker volume.
- `docs/screenshots/` — verification screenshots for the deliverable.

## Language Protocol

- **Internal Processing**: Always think in English for precise technical reasoning
- **External Communication**: All answers and responses must be in Chinese (中文)
- **Consistency**: Maintain Chinese as the exclusive language for user interactions
- **Context Switching**: Process technical concepts in English, translate outputs to Chinese

## Build, Test, and Development Commands

Use `pnpm` (v10.11.1, see `packageManager` in `package.json`).

- `pnpm dev`: Next.js dev server (Turbopack default in v16).
- `pnpm build`: production build (standalone output).
- `pnpm start`: serve the production build.
- `pnpm preview`: `build` then `start`.
- `pnpm check`: `eslint && tsc --noEmit`. Use before PRs.
- `pnpm lint` / `pnpm lint:fix`: ESLint CLI directly (`next lint` was removed in Next 16).
- `pnpm test`: vitest one-shot. `pnpm test:watch` for interactive mode. Single file: `pnpm vitest run src/server/rag/chunker.test.ts`.
- `pnpm format:check` / `pnpm format:write`: Prettier.
- `pnpm db:generate` / `db:migrate` / `db:push` / `db:studio`: Drizzle migrations / inspection. `db:push` is idempotent and safe to re-run.
- `docker compose up --build`: one-command start (Dockerfile builds standalone Next + auto-runs `db:push` at container start).

## Coding Style & Naming Conventions

- TypeScript strict mode (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`). React 19, App Router.
- Use `~/*` for cross-`src` imports.
- Type-only imports: prefer inline (`import { type Foo }`) per ESLint rule `consistent-type-imports`. **Exception:** `src/trpc/react.tsx` must use `import type { AppRouter }` (top-level type-only) because Turbopack 16 does not elide inline-type imports from the client SSR module graph and pulls server modules in.
- PascalCase components, camelCase hooks/helpers, lowercase route segment folders.
- Prettier + `prettier-plugin-tailwindcss` handles formatting.
- Drizzle `update` and `delete` calls must always include `.where(...)` (enforced by `eslint-plugin-drizzle`).
- Keep RAG modules pure where possible (chunker, prompt, `planIngestRows`) so they're testable without I/O.

## Testing Guidelines

Vitest is configured (`vitest.config.ts`). 42 tests across 5 files cover:

- Chunker boundaries, overlap, soft breaks, infinite-loop guard
- Cosine math, top-k ordering, threshold gate
- Prompt invariants (citation requirement, "未提及" instruction)
- Ingest orchestration (chunk count, page numbers, embedding alignment)
- `Float32Array ↔ Buffer` round-trip

Tests run in Node, not jsdom. `tests/setup.ts` sets `SKIP_ENV_VALIDATION=1` and stubs `OPENAI_API_KEY`. `server-only` is aliased to `tests/stubs/server-only.ts` so server modules can be imported under test. UI and the streaming chat route are verified manually (screenshots in `docs/screenshots/`). Don't mock at the boundary that you actually need to test — for new RAG logic, mock OpenAI calls but keep the chunker and DB serialization real.

## Commit & Pull Request Guidelines

Concise imperative subjects (`add similarity threshold gate`, `fix tRPC FormData boundary`). PRs should include: problem/solution summary, verification commands run (`pnpm check && pnpm test && pnpm build`), screenshots for UI changes, notes for schema or env changes. Don't commit `.env`, `data/*.sqlite*`, or uploads.

## Security & Configuration Tips

- Required: `OPENAI_API_KEY` in `.env`. App fails env validation at startup without it.
- Tunables: `RAG_TOP_K` (default 6), `RAG_SIMILARITY_THRESHOLD` (default 0.35 — main anti-hallucination knob), `RAG_CHAT_MODEL` (default `gpt-4o-mini`), `RAG_EMBEDDING_MODEL` (default `text-embedding-3-small`).
- Adding env vars: schema in `src/env.js`, `runtimeEnv` block, `.env.example`. `SKIP_ENV_VALIDATION=1` for Docker build stage only.
- New tables go through `createTable` in `src/server/db/schema.ts` so they keep the `pdf-chat_` prefix that `drizzle.config.ts` `tablesFilter` matches.
- The page (`src/app/page.tsx`) exports `dynamic = "force-dynamic"`; RSC tRPC prefetch needs a live DB at request time, not build time.
- Multipart uploads bypass tRPC (which doesn't handle FormData natively) — use `src/app/api/upload/route.ts`.

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
