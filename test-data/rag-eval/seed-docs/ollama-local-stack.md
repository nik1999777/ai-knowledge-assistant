# Ollama Local Stack

Ollama is used in this project as the local model runtime.

The API calls Ollama for two different tasks:

1. Embeddings: the `nomic-embed-text` model turns document chunks and user questions into vectors.
2. Generation: the `llama3` model generates the final answer from the grounded prompt.

The local stack also includes Postgres and Qdrant.

Postgres stores document metadata, full extracted text, full-text search vectors, chat sessions, and chat messages.

Qdrant stores vector embeddings for document chunks and supports similarity search.

The Fastify API coordinates the RAG pipeline. It parses uploaded documents, creates chunks, requests embeddings from Ollama, writes metadata to Postgres, writes vectors to Qdrant, retrieves context, applies answerability rules, and streams the final answer.

The React frontend lets the user upload documents, chat with the knowledge base, inspect sources, and review eval metrics.

