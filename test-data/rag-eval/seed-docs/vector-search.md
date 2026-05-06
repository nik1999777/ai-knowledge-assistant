# Vector Search Notes

Embeddings are numeric vector representations of text. Similar meanings should produce vectors that are close to each other in vector space.

Vector search finds chunks whose embeddings are similar to the question embedding. This is useful when the user asks with different wording than the original document.

Qdrant is the vector database in this project. It stores chunk embeddings and payload metadata such as `docId`, `title`, `chunkIndex`, `section`, and the chunk text.

Similarity search is handled by Qdrant. The application sends a question embedding to Qdrant and receives the nearest chunks with similarity scores.

Lexical search is different from vector search. Lexical search matches words and tokens, while vector search matches semantic similarity.

Hybrid retrieval combines vector candidates with lexical candidates. It is often better than either method alone because semantic search and keyword search fail in different ways.

Reranking is a second scoring step after retrieval. It reorders candidate chunks so the final context sent to the language model is more relevant.

