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

1. User uploads `.txt`, `.md`, `.csv`, `.pdf`, `.docx`, or `.zip`.
   ZIP uploads are treated as archive documents and index supported text files
   inside, such as Markdown/CSV exports with folders.
2. Backend parses the document.
3. Backend chunks text into retrieval units.
   Each chunk carries `chunkIndex`, `chunkLen`, `section`, `startOffset`, and
   `endOffset` for source inspection.
4. Ollama creates embeddings for chunks.
5. Postgres stores document metadata, full text, FTS `search_vector`, chat
   sessions, chat messages, sources, timing, and debug JSON.
6. Qdrant stores chunk vectors and payload.
7. Chat builds a RAG context through hybrid retrieval.
8. Decision policy chooses answer or safe decline.
9. Ollama receives grounded context with source title, section, chunk index, and
   chunk text, then streams generation through SSE.
10. Answer, sources, timing, and debug are saved to chat history.

## Prompt Versioning

The grounded RAG prompt is versioned in `apps/api/src/services/prompt.service.ts`
as `RAG_PROMPT_VERSION`.

The current version is:

```text
rag-grounded-v3
```

Each chat response stores `debug.promptVersion`. Eval results also record the
prompt version so quality reports can be tied to the prompt behavior that
produced them.

## Generation Options

Ollama generation is configured explicitly for repeatable local eval:

- `OLLAMA_LLM_TEMPERATURE`, default `0`
- `OLLAMA_LLM_SEED`, default `42`

These values are passed through Ollama `/api/generate` `options` for both
streaming chat and non-streaming LLM calls. Each chat/eval debug payload stores
them as `debug.generationOptions`.

## RAG Engineering Principles

Do not improve the assistant by accumulating document-specific `if` statements
or narrow prompt rules for particular wording patterns. This project should work
for arbitrary user uploads, so fixes must stay portable across domains.

Avoid patterns like:

- `if document text contains "roles:", ask a roles-specific question`
- prompt rules for one phrasing such as "if the question asks exactly X..."
- code branches tied to current sample documents, titles, sections, or business
  vocabulary

Prefer production-style changes:

- general retrieval, ranking, chunking, and metadata contracts
- compact prompt policies that express invariant behavior
- prompt/version/generation metadata in debug reports
- eval cases that expose failures without hardcoding the fix
- deterministic or validated generators with broad heuristics, not domain rules

If a bug appears only for one document shape, first ask what general capability
is missing: better chunk metadata, source context, citation contract, parser
output, retrieval trace, or eval coverage. Only add a special case if it is a
well-named, documented, domain-independent parser/format rule.

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
npm run eval:generate
npm run eval:generated
```

- `eval:seed`: reindexes stable seed docs into `documentScope=eval`, runs
  `questions.seed.json`, and writes `last-seed-report.json`.
- `eval:current`: runs `questions.json` against the current user document base.
- `eval:generate`: builds `questions.generated.json` from current user
  document chunks.
- `eval:generated`: regenerates `questions.generated.json`, runs those cases
  against `documentScope=user`, and writes `last-generated-report.json`.
- `eval:rag`: alias for `eval:current`.

Generated eval foundation is deterministic/extractive: it selects useful chunks,
builds answerable questions from chunk keywords, stores expected answer/source
keywords, evidence quotes, and chunk spans, then adds a few stable unanswerable
cases. It does not use an LLM to author questions yet.

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

## Source Spans

Retrieval sources now include chunk-level character spans:

- `startOffset`
- `endOffset`

These offsets point into the normalized text used by the chunker. They are
metadata for inspection/debugging and are carried through Qdrant payloads, chat
sources, document detail chunks, and eval source snapshots.

Important limitation: this is not answer-level citation extraction yet. The
assistant still cites retrieved chunks, not individual generated claims.

## Known Limitations

- No auth/user ownership yet.
- Ingestion is synchronous.
- No async ingestion status/jobs.
- No answer-level citations.
- Generated eval exists, but it is deterministic/extractive rather than
  LLM-authored.
- Chunking is simple.
- Rerank is local, not cross-encoder-based.
- No observability dashboard.

## Suggested Next Engineering Steps

1. Quality + eval foundation.
   - Keep eval first before adding more product features.
   - Expand eval cases.
   - Keep categories: `answerable`, `unanswerable`, `tricky`, `exact`,
     `multi-hop`.
   - Show category summary, failed cases, `bestScore`, `decision`, and
     `guardrailReason`.
2. Generated eval for current user documents.
   - Foundation exists through `eval:generate` and `eval:generated`.
   - Next: improve question diversity and add harder generated categories.
   - Later: optionally use an LLM generator with strict JSON validation.
3. Retrieval Debug panel.
   - RRF exists, but a dedicated panel should show vector candidates, lexical
     candidates, merged/hybrid candidates, filtered candidates, raw ranks/scores,
     and final rerank.
4. Async ingestion and statuses.
   - Move toward `uploaded -> processing -> indexed` or `failed`.
   - API should return `docId` quickly.
   - Backend should index in a separate job/process.
   - UI should show status, retry, and error message.
5. Citations/source spans.
   - Chunk-level `section`, `chunkIndex`, `startOffset`, and `endOffset` exist.
   - Next: add answer-level citations that bind generated claims to evidence spans.
   - Later add PDF page number.
   - Show exact evidence source in answers.
6. Security / ownership.
   - Add simple auth model.
   - Documents and chat history should belong to user/tenant.
   - Retrieval should filter Postgres and Qdrant by user/tenant.
7. LangChain comparison mode.
   - Keep handmade pipeline as primary.
   - Add experimental `/chat/langchain/stream`.
   - Compare architecture and behavior on `/architecture`.
8. LangGraph / agentic retrieval.
   - Planner -> query rewrite -> retrieval -> rerank -> answer/clarify/decline.
9. Better chunking, stronger reranker, observability/tracing.

## Git Workflow Preference

After completing a meaningful change:

1. Update `/architecture` or docs when behavior/architecture changes.
2. Run relevant checks.
3. Commit.
4. Push to `origin/main`.
