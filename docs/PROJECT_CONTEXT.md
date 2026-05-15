# AI Knowledge Assistant - Project Context

## What This Project Is

AI Knowledge Assistant is a local RAG assistant for user-provided documents.
It runs as a React/Vite frontend, Fastify API backend, Postgres metadata store,
Qdrant vector store, and local Ollama models.

The assistant does not search the internet. It answers from documents uploaded
into the local knowledge base.

## Repository

- GitHub: `https://github.com/nik1999777/ai-knowledge-assistant`
- API: `apps/api`
- Web: `apps/web`
- Infrastructure: `infra/docker-compose.yml`
- Eval data: `test-data/rag-eval`

## Local Stack

- Frontend: React + Vite + styled-components + react-markdown + remark-gfm
- Backend: Fastify (TypeScript)
- Metadata / history / FTS: Postgres
- Vector search: Qdrant
- Embeddings: Ollama `nomic-embed-text` (asymmetric — see below)
- Generation: Ollama (model configured via `OLLAMA_LLM_MODEL`)

## Run Commands

From repo root:

```bash
docker compose -f infra/docker-compose.yml up -d
```

API:

```bash
cd apps/api
npm run dev
```

Web:

```bash
cd apps/web
npm run dev
```

Important: Vite 7 requires Node `20.19+` or `22.12+`. Older Node versions
can fail with `crypto.hash is not a function`.

## Main Pages

- `/` — chat page: ask questions against uploaded user documents.
  Composer includes answer modes: `Strict`, `Balanced`, `Tutor`.
- `/documents` — list, upload, search, and delete user documents.
- `/documents/:docId` — inspect document details, chunks, and readable markdown.
- `/architecture` — interactive architecture guide.
- `/eval` — inspect the latest eval report.

## Core Pipeline

### Ingestion (async)

1. User uploads `.txt`, `.md`, `.csv`, `.pdf`, `.docx`, or `.zip`.
   ZIP uploads are treated as archive imports.
2. Backend parses and normalizes the document synchronously:
   - Markdown link targets are cleaned for indexing.
   - Navigation-only pages (table-of-contents) are skipped.
3. Backend chunks text into retrieval units with `chunkIndex`, `chunkLen`,
   `section`, `startOffset`, `endOffset`.
4. Document record is created in Postgres with `ingestion_status = 'processing'`.
   API returns immediately with `docId`.
5. **Background:** Ollama creates embeddings using `search_document:` prefix
   (asymmetric embeddings). Chunks are saved to `document_chunks` table.
   Qdrant receives vectors and payloads.
6. On success: `ingestion_status → 'indexed'`. On failure: `'failed'`.
7. Frontend polls every 2s while any document is in `processing` state.
   Status badge: yellow pulsing "Индексация..." → "Открыть" or red "Ошибка".

### Chat / RAG

1. **Query rewriting** — `rewriteQueryForSearch(question, previousQuestion?)` calls Ollama with
   `temperature=0, num_predict=40` to extract 3–7 key search terms.
   If a previous question exists in the session, it is passed as context so the rewriter
   can resolve follow-up references ("it", "this", "that"). Falls back to original question
   on any error. Timing stored as `rewriteMs`.
2. **Embedding** — rewritten query is embedded with `search_query:` prefix
   (asymmetric: different prefix than document embeddings).
3. **Vector search** — Qdrant returns top-K candidates.
4. **Lexical search** — Postgres FTS on `document_chunks` using rewritten query.
5. **RRF fusion** — Reciprocal Rank Fusion merges vector and lexical results.
6. **Rerank** — local rerank with token overlap, title/section overlap, phrase
   bonus, and short chunk penalty.
7. **Decision policy** — checks `bestScore`, `domainEvidence`, `declineThreshold`,
   `answerThreshold`. Declines without calling LLM if evidence is weak.
8. **Generation** — Ollama receives system prompt (rules + mode policy) and
   user prompt (context + conversation history + question + "Ответ:") as separate
   parameters. Streams via SSE. Preamble filter strips any echoed instruction headers.
9. **Post-processing** — `stripAnswerPreamble` + `normalizeDeclineAnswer`.
10. Answer, sources, timing, debug saved to Postgres chat history.

## Asymmetric Embeddings

`nomic-embed-text` supports instructional prefixes that improve retrieval quality:

- Documents are embedded as `search_document: {text}`
- Queries are embedded as `search_query: {text}` (after rewriting)

Functions:
- `getDocumentEmbedding(text)` — used during ingestion and reindex
- `getQueryEmbedding(text)` — used during chat retrieval
- `getEmbedding` is aliased to `getDocumentEmbedding`

Reindex script: `npm run reindex [scope]` — re-embeds all documents in a scope
using stored chunks from `document_chunks` table.

## Query Rewriting

Before retrieval, a fast LLM call extracts key search terms from the user's
natural-language question. This improves both vector embedding quality and FTS
precision by removing conversational noise.

- Service: `apps/api/src/services/query-rewrite.service.ts`
- Uses `OLLAMA_LLM_MODEL` with `temperature=0, seed=42, num_predict=40`
- Falls back to original question on any error
- `searchQuery` (rewritten) is stored in `debug.searchQuery`
- Visible in the frontend debug panel
- Accepts optional `previousQuestion` — if the current question references
  something from the previous turn ("it", "this", "that"), the rewriter resolves
  the reference before extracting terms.

## Prompt Architecture

Prompt version: `rag-grounded-v7`

Instructions and context are sent as **separate** Ollama parameters:

```
system: <rules + mode policy>    ← model never echoes this
prompt: Документы:\n{context}\n\nИстория диалога:\nПользователь: ...\nАссистент: ...\n\nВопрос: {question}\n\nОтвет:
```

History section is omitted when there are no prior turns.

This prevents the model from echoing "БАЗОВЫЙ КОНТРАКТ / РЕЖИМ" headers in
the answer. `stripAnswerPreamble` + `createPreambleFilter` remain as fallback.

System prompt structure (per mode):
- **Base rules**: Russian language, concise answer, no hedging, markdown formatting.
- **Mode policy**: `strict` / `balanced` / `tutor` (self-contained grounding scope).

Answer modes:
- `strict`: direct answer from context only; otherwise decline.
- `balanced`: grounded partial-answer; state what is present and what is missing.
- `tutor`: "По документам:" from context, then "Общее пояснение:" from general
  knowledge only if context is at least partially related.

## Conversation Memory

Each chat session maintains conversation context across turns (like Claude/ChatGPT).

Pipeline:
1. Before handling a question, `loadRecentHistory(sessionId, maxTurns=3)` fetches
   the last 3 Q&A pairs from `chat_messages` (6 rows DESC, then reversed).
2. History is injected into the RAG prompt between the documents context and the
   current question (see Prompt Architecture above).
3. The previous question is also forwarded to `rewriteQueryForSearch` so pronoun
   references ("it", "this") can be resolved before retrieval.

Key files:
- `apps/api/src/modules/chat/chat-history.service.ts` — `loadRecentHistory`
- `apps/api/src/services/prompt.service.ts` — `buildRagPrompt` with `history`
- `apps/api/src/services/query-rewrite.service.ts` — `rewriteQueryForSearch` with `previousQuestion`
- `apps/api/src/repositories/chat.repository.ts` — `getRecentChatMessages`

## Generation Options

Repeatable local eval via explicit Ollama options:

- `OLLAMA_LLM_TEMPERATURE`, default `0`
- `OLLAMA_LLM_SEED`, default `42`

Stored as `debug.generationOptions` in each chat response.

## Markdown Rendering

All LLM answers and document "Readable" view are rendered as markdown:

- Library: `react-markdown` + `remark-gfm`
- Component: `apps/web/src/shared/components/MarkdownAnswer.tsx`
- Applied to: final answers, streaming answers, document detail readable view
- Supports: code blocks (dark background), tables, lists, headers, blockquote,
  inline code, bold/italic

## Retrieval

Hybrid retrieval pipeline:

1. Vector search — Qdrant, asymmetric query embedding
2. Lexical search — Postgres FTS on `document_chunks` table, rewritten query
3. Deduplication by `docId:chunkIndex`
4. RRF fusion (k=60)
5. Local rerank — token overlap, title/section overlap, phrase bonus, short chunk penalty

Source debug fields:
- `origin`: `vector`, `lexical`, or `hybrid`
- `vectorRank` / `vectorScore` — raw Qdrant rank and score
- `lexicalRank` / `lexicalScore` — raw lexical rank and score
- `rrfScore` — normalized RRF signal
- `finalScore` — score after local rerank
- `bestScore` — final score of top source
- `answerSupport` — heuristic answer audit: `status`, `score`, `matchedTerms`, `missingTerms`
- `retrievalTrace` — per-stage trace: `vector`, `lexical`, `merged`, `reranked`, `final`
- `searchQuery` — rewritten query used for retrieval

## Decision Policy

Main signals: `bestScore`, `declineThreshold`, `answerThreshold`, `domainEvidence`.

If evidence is weak, returns exactly:
```
Я не знаю на основе предоставленных данных.
```
without calling the LLM.

## Document Scope

Documents are isolated by `documentScope`:
- `user` — normal user documents
- `eval` — stable benchmark documents

## Storage

### Postgres Tables

- `documents` — metadata, `text_content`, `raw_text_content`, `search_vector`,
  `ingestion_status` (`processing` / `indexed` / `failed`)
- `document_chunks` — `doc_id`, `chunk_index`, `chunk_text`, `section`,
  `chunk_len`, `start_offset`, `end_offset`
- `chat_sessions` — session metadata
- `chat_exchanges` — question, answer, sources, timing, debug JSON

### Qdrant

Collection per scope (`user`, `eval`). Each point has vector + payload:
`docId`, `title`, `sourceType`, `text`, `chunkIndex`, `chunkLen`,
`section`, `startOffset`, `endOffset`.

## Eval

Commands:

```bash
cd apps/api
npm run eval:seed      # seed benchmark
npm run eval:generate  # build generated questions from user docs
npm run eval:generated # run generated eval against user scope
npm run eval:modes     # mode matrix (strict / balanced / tutor)
```

Current seed benchmark (`rag-grounded-v7`):
- `answerability_accuracy = 0.938`
- `tp=11, tn=4, fp=0, fn=1`

(Previous v6 baseline: accuracy=1.000. The fn=1 regression is under investigation.)

Mode Matrix (last run on v7):

| Mode     | accuracy | fp | fn | decline |
|----------|----------|----|----|---------|
| balanced | 0.938    | 0  | 1  | 31.3%   |

## Navigation Layout

All pages share a persistent sidebar via `AppShell` + `AppSidebar`:

- `apps/web/src/shared/components/AppShell.tsx` — grid layout (`280px sidebar + content`)
- `apps/web/src/shared/components/AppSidebar.tsx` — brand, "Новый чат" button, nav links
  with SVG icons (Chat, Documents, Architecture, Eval), optional `children` slot
- Pages pass `sidebarContent` (e.g., sessions list) and `onNewChat` to `AppShell`
- Non-chat pages use `<AppShell scrollable>` with a `PageContent` wrapper

## Architecture UI

The `/architecture` page is an interactive project guide.

- UI: `apps/web/src/pages/architecture/ArchitecturePage.tsx`
- Content: `apps/web/src/pages/architecture/architectureContent.ts`

Includes: pipeline overview, visual flows, trace explorer, retrieval explanations,
eval explanations, storage map, API explorer, debug decoder, glossary,
design trade-offs, real payload examples, failure playbook, known limitations,
roadmap, full walkthrough.

## Source Spans

Chunk-level character spans `startOffset` / `endOffset` are stored in
`document_chunks`, carried through Qdrant payloads, chat sources, document detail
chunks, and eval source snapshots. Not yet answer-level citations.

## Known Limitations

- No auth/user ownership.
- Reindex script required when changing embedding prefixes (existing Qdrant vectors
  were created without prefixes before asymmetric embeddings were added).
- Rerank is local, not cross-encoder-based.
- Generated eval is deterministic/extractive, not LLM-authored.
- No observability dashboard.

## Suggested Next Engineering Steps

1. Improve eval quality after v7 prompt refactor.
   The fn=1 regression (seed-014, score=0.518, policy=false, model=true) should
   be investigated — it answers when it should decline. Check if system/prompt
   split affected the balanced mode grounding behavior.

2. Answer-level citations.
   Chunk spans exist. Next: bind generated claims to evidence spans.

3. Better chunking / cross-encoder reranker.

4. Auth / user ownership.

5. Observability dashboard.

## Git Workflow Preference

After completing a meaningful change:

1. Update `docs/PROJECT_CONTEXT.md` when behavior/architecture changes.
2. Run relevant checks (`tsc`, `eval:seed`).
3. Commit with descriptive message.
4. Push to `origin/main`.

## RAG Engineering Principles

Do not improve the assistant by accumulating document-specific `if` statements
or narrow prompt rules for particular wording patterns. Fixes must stay portable
across domains.

Avoid:
- `if document text contains "roles:", ask a roles-specific question`
- prompt rules for one phrasing
- code branches tied to current sample documents

Prefer:
- general retrieval, ranking, chunking, and metadata contracts
- compact prompt policies that express invariant behavior
- prompt/version/generation metadata in debug reports
- eval cases that expose failures without hardcoding the fix
