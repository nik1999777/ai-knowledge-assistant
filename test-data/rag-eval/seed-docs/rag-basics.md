# RAG Basics

Retrieval-Augmented Generation, or RAG, is a pattern where an application retrieves relevant knowledge before asking a language model to answer.

The goal of RAG is to ground the answer in documents that the application controls. Instead of relying only on model memory, the system passes retrieved context into the prompt.

RAG usually has two flows:

1. Ingestion: parse documents, split them into chunks, create embeddings, and store searchable records.
2. Query answering: embed the user question, retrieve relevant chunks, build a grounded prompt, and generate an answer.

Chunking matters because long documents are too large and noisy to pass into a prompt directly. Smaller chunks make retrieval more precise, while overlap helps preserve context across chunk boundaries.

A good RAG system should cite sources, measure retrieval quality, and decline questions when the retrieved context is not enough.

RAG can reduce hallucinations because the model is instructed to answer from retrieved context rather than inventing facts from general training data.

