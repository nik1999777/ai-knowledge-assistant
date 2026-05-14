import { env } from "../config/env.js";
import { postOllamaJson } from "../clients/ollama.client.js";

async function embed(text: string): Promise<number[]> {
  const data = await postOllamaJson<{ embedding: number[] }>(
    "/api/embeddings",
    {
      model: env.OLLAMA_EMBED_MODEL,
      prompt: text,
    },
    "Embedding request",
  );

  return data.embedding;
}

export function getQueryEmbedding(text: string): Promise<number[]> {
  return embed(`search_query: ${text}`);
}

export function getDocumentEmbedding(text: string): Promise<number[]> {
  return embed(`search_document: ${text}`);
}

export const getEmbedding = getDocumentEmbedding;
