# AI Knowledge Assistant

Local RAG assistant for learning and demonstrating production-oriented retrieval workflows.

The project lets you upload documents, index them into a knowledge base, ask questions over that knowledge base, inspect retrieved sources, and review eval/debug metrics directly in the UI.

## Stack

- Frontend: React, Vite, TypeScript, styled-components, TanStack Query
- Backend: Fastify, TypeScript
- Storage: Postgres for metadata, full-text search, and chat history
- Vector search: Qdrant
- Local models: Ollama for embeddings and LLM generation

## Main Flows

- Document ingestion: upload `.txt`, `.md`, `.pdf`, `.docx`, parse text, chunk, embed, and store chunks in Qdrant.
- Chat over knowledge base: hybrid vector + lexical retrieval, rerank, answerability decision, grounded prompt, SSE streaming.
- Eval dashboard: view the latest RAG eval report at `/eval`.
- Architecture page: inspect the RAG pipeline at `/architecture`.

## Run Locally

Start infrastructure:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Make sure Ollama is running and models are available:

```bash
ollama serve
ollama pull llama3
ollama pull nomic-embed-text
```

Start API:

```bash
cd apps/api
cp .env.example .env
npm install
npm run dev
```

Start web:

```bash
cd apps/web
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

## Eval

Run from `apps/api`:

```bash
npm run eval:rag
```

The script writes `test-data/rag-eval/last-report.json`. The frontend reads it through `GET /eval/report` and shows quality metrics at `/eval`.

