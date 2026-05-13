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
  The composer includes answer modes: `Strict`, `Balanced`, and `Tutor`.
- `/documents`: list, upload, search, and delete user documents.
- `/documents/:docId`: inspect document details and chunks.
- `/architecture`: interactive architecture guide.
- `/eval`: inspect the latest eval report.

## Core Pipeline

1. User uploads `.txt`, `.md`, `.csv`, `.pdf`, `.docx`, or `.zip`.
   ZIP uploads are treated as archive imports: supported text files inside,
   such as Markdown/CSV exports with folders, are indexed as separate documents
   with their archive path stored as `originalFileName`.
2. Backend parses the document.
   Markdown link targets are normalized away for indexing/display, so
   `[visible title](long/path-or-url)` contributes the visible title without
   polluting retrieval with long encoded paths.
   Standalone local `.md` links are treated as archive navigation and removed
   from indexed text, so table-of-contents pages do not outrank actual content.
   Archive Markdown files that are mostly standalone local links and headings
   are skipped as navigation-only pages.
   Markdown link parsing tolerates exported file names with unbalanced
   parentheses when the target is still a local `.md` path.
3. Backend chunks text into retrieval units.
   Each chunk carries `chunkIndex`, `chunkLen`, `section`, `startOffset`, and
   `endOffset` for source inspection.
4. Ollama creates embeddings for chunks.
5. Postgres stores document metadata, raw text for inspection, normalized
   indexed text, FTS `search_vector`, chat sessions, chat messages, sources,
   timing, and debug JSON.
6. Qdrant stores chunk vectors and payload.
7. Chat builds a RAG context through hybrid retrieval.
8. Decision policy chooses answer or safe decline.
9. Ollama receives grounded context with source title, section, chunk index, and
   chunk text, then streams generation through SSE.
10. If the model emits the decline phrase with extra text around it, backend
    normalizes the saved answer to the exact decline contract.
11. Answer, sources, timing, answer mode, and debug are saved to chat history.

## Prompt Versioning

The grounded RAG prompt is versioned in `apps/api/src/services/prompt.service.ts`
as `RAG_PROMPT_VERSION`.

The current version is:

```text
rag-grounded-v5
```

Version `rag-grounded-v5` uses grounded partial answers: when the context
mentions a term but does not explicitly define it, the assistant should say the
term is not explicitly defined in the found fragments and summarize only the
available mentions instead of adding a definition from general model knowledge.

Chat requests support `answerMode`:

- `strict`: answer only when context explicitly contains a direct answer;
  otherwise decline.
- `balanced`: default grounded partial-answer mode. Summarize what is present,
  state what is missing, and do not use external knowledge.
- `tutor`: first answer from documents, then optionally add a clearly separated
  general explanation when retrieved context is related but partial.

Each chat response stores `debug.promptVersion` and `debug.answerMode`. Eval
results also record the prompt version so quality reports can be tied to the
prompt behavior that produced them. Current eval runs use `balanced`.

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
- Lexical ranking uses relaxed OR-match score as the base for all matching
  documents, with strict AND-match as a bonus. This avoids burying strong
  title/body matches whose strict rank is numerically tiny.
- Deduplication by `docId:chunkIndex`.
- Reciprocal Rank Fusion (RRF).
- Local rerank with token overlap, title/section overlap, phrase bonus, and short
  chunk penalty.
- Query token coverage does not use a hand-maintained stop-word list. Verbose
  questions are handled by capping the overlap denominator, so extra wording in
  the question does not dilute strong matches indefinitely.
- Section overlap is treated as scoped metadata: it is strongest when the
  document title also matches the query, so generic section names do not outrank
  the intended document.

Important source debug fields:

- `origin`: `vector`, `lexical`, or `hybrid`.
- `vectorRank` / `vectorScore`: raw Qdrant rank and score.
- `lexicalRank` / `lexicalScore`: raw lexical rank and score.
- `rrfScore`: normalized RRF signal.
- `finalScore`: score after local rerank.
- `bestScore`: final score of the top source.
- `answerSupport`: heuristic answer audit with `status`, `score`,
  `matchedTerms`, and `missingTerms`. It compares generated answer tokens
  against retrieved source text and is intended for debugging, not as a formal
  proof of factuality.
- `retrievalTrace`: compact per-stage retrieval trace for chat/history debug:
  `vector`, `lexical`, `merged`, `reranked`, and `final`. Each stage stores
  candidate titles, chunk indexes, ranks/scores, and a short preview so the UI
  can explain why the final context was selected.

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
npm run eval:generate
npm run eval:generated
```

- `eval:seed`: reindexes stable seed docs into `documentScope=eval`, runs
  `questions.seed.json`, and writes `last-seed-report.json`.
- `eval:generate`: builds `questions.generated.json` from current user
  document chunks.
- `eval:generated`: regenerates `questions.generated.json`, runs those cases
  against `documentScope=user`, and writes `last-generated-report.json`.

Generated eval foundation is deterministic/extractive: it selects useful chunks,
builds answerable questions from chunk keywords, stores expected answer/source
keywords, evidence quotes, and chunk spans, then adds a few stable unanswerable
cases. It does not use an LLM to author questions yet.

For arbitrary uploaded documents, `eval:generated` is the primary user-KB smoke
test. A red generated report is a diagnostic signal for the current uploaded
KB/retrieval/prompt behavior, not a stable release benchmark. `eval:seed`
remains the regression benchmark.

Eval case results include `answerMode`, `answerSupport`, and compact
`retrievalTrace` snapshots, and the `/eval` failed-case cards can inspect the
same support/trace signals used by chat debug.

Current stable seed benchmark after grounded partial-answer prompt changes:

- `answerability_accuracy=1.000`
- `tp=12`
- `tn=4`
- `fp=0`
- `fn=0`

Current generated user-KB smoke report after capped query-overlap scoring:

- `answerability_accuracy=1.000`
- `tp=12`
- `tn=3`
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
- Retrieval trace tabs for vector, lexical, merged, reranked, and final context
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
The chat UI highlights matched `answerSupport.matchedTerms` inside source
chunks to make grounding easier to inspect.

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
   - Category summaries, failed cases, `bestScore`, `decision`,
     `guardrailReason`, answer support, and retrieval trace are visible.
2. Generated eval for current user documents.
   - Foundation exists through `eval:generate` and `eval:generated`.
   - Next: improve question diversity and add harder generated categories.
   - Later: optionally use an LLM generator with strict JSON validation.
3. Retrieval Debug panel.
   - Chat and eval failed-case debug now show vector, lexical, merged, reranked,
     and final candidates. Next: add filtering/search within trace and compare
     candidate movement across stages.
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
