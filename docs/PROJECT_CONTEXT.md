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

- Frontend: React + Vite
- Backend: Fastify
- Metadata/history/search: Postgres
- Vector search: Qdrant
- Embeddings: Ollama `nomic-embed-text`
- Generation: Ollama `llama3`

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

Important: Vite 7 requires Node `20.19+` or `22.12+`. Older Node versions such
as `20.10.0` can fail with `crypto.hash is not a function`.

## Main Pages

- `/` or chat page: ask questions against uploaded user documents.
- `/documents`: list, upload, search, and delete user documents.
- `/documents/:docId`: inspect document details and chunks.
- `/architecture`: interactive architecture guide.
- `/eval`: inspect the latest eval report.

## Core Pipeline

1. User uploads `.txt`, `.md`, `.pdf`, or `.docx`.
2. Backend parses the document.
3. Backend chunks text into retrieval units.
4. Ollama creates embeddings for chunks.
5. Postgres stores document metadata, full text, FTS `search_vector`, chat
   sessions, chat messages, sources, timing, and debug JSON.
6. Qdrant stores chunk vectors and payload.
7. Chat builds a RAG context through hybrid retrieval.
8. Decision policy chooses answer or safe decline.
9. Ollama streams grounded generation through SSE.
10. Answer, sources, timing, and debug are saved to chat history.

## Retrieval

Retrieval is hybrid:

- Vector search through Qdrant.
- Lexical search through Postgres FTS.
- Deduplication by `docId:chunkIndex`.
- Reciprocal Rank Fusion (RRF).
- Local rerank with token overlap, title/section overlap, phrase bonus, and short
  chunk penalty.

Important source debug fields:

- `origin`: `vector`, `lexical`, or `hybrid`.
- `vectorRank` / `vectorScore`: raw Qdrant rank and score.
- `lexicalRank` / `lexicalScore`: raw lexical rank and score.
- `rrfScore`: normalized RRF signal.
- `finalScore`: score after local rerank.
- `bestScore`: final score of the top source.

## Decision Policy

The assistant should answer only when retrieved evidence is strong enough.

Main signals:

- `bestScore`
- `declineThreshold`
- `answerThreshold`
- `domainEvidence`
- source count and hybrid evidence

If evidence is weak, the API returns:

```text
Я не знаю на основе предоставленных данных.
```

without calling the LLM.

## Document Scope

Documents are isolated by `documentScope`:

- `user`: normal user documents.
- `eval`: stable benchmark documents.

The normal chat and `/documents` use `user` scope. Seed eval uses `eval` scope.
Both Postgres and Qdrant queries must apply the correct scope.

## Eval

Commands:

```bash
cd apps/api
npm run eval:seed
npm run eval:current
```

- `eval:seed`: reindexes stable seed docs into `documentScope=eval`, runs
  `questions.seed.json`, and writes `last-seed-report.json`.
- `eval:current`: runs `questions.json` against the current user document base.
- `eval:rag`: alias for `eval:current`.

Current stable seed benchmark after RRF/scope changes:

- `answerability_accuracy=1.000`
- `tp=11`
- `tn=4`
- `fp=0`
- `fn=0`

## Architecture UI

The `/architecture` page is an interactive project guide. Its UI is in:

- `apps/web/src/pages/architecture/ArchitecturePage.tsx`

Its content data is in:

- `apps/web/src/pages/architecture/architectureContent.ts`

The page currently includes:

- Pipeline overview
- Visual Document/Chat/Eval flows
- Trace Explorer
- Retrieval explanations
- Eval explanations
- Storage map
- API explorer
- Debug decoder
- Glossary
- Design trade-offs
- Real payload examples
- Failure playbook
- Known limitations
- Roadmap
- Full walkthrough for one RAG question

The markdown docs are not used to generate the UI. This is intentional for now:
the page is interactive and type-safe TS data is simpler to maintain than a
markdown-to-UI generation layer.

## Known Limitations

- No auth/user ownership yet.
- Ingestion is synchronous.
- No async ingestion status/jobs.
- No answer-level citations/source spans.
- No generated eval for user documents yet.
- Chunking is simple.
- Rerank is local, not cross-encoder-based.
- No observability dashboard.

## Suggested Next Engineering Steps

1. Citations/source spans.
2. Generated eval for current user documents.
3. Async ingestion and statuses.
4. Auth/user ownership.
5. Better chunking.
6. Stronger reranker.
7. Observability/tracing.

## Git Workflow Preference

After completing a meaningful change:

1. Update `/architecture` or docs when behavior/architecture changes.
2. Run relevant checks.
3. Commit.
4. Push to `origin/main`.

