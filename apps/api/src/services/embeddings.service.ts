import { env } from "../config/env.js";
import { postOllamaJson } from "../clients/ollama.client.js";

export async function getEmbedding(text: string): Promise<number[]> {
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
