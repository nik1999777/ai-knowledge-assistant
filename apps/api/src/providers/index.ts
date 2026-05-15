import { env } from "../config/env.js";
import type { LLMProvider } from "./llm.provider.js";
import { OllamaProvider } from "./ollama.provider.js";
import { OpenAIProvider } from "./openai.provider.js";

function createProvider(modelOverride?: string): LLMProvider {
  if (env.LLM_PROVIDER === "openai") {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");

    return new OpenAIProvider(
      modelOverride ?? env.OPENAI_LLM_MODEL,
      env.OPENAI_EMBED_MODEL,
      apiKey,
      env.OLLAMA_LLM_TEMPERATURE,
    );
  }

  return new OllamaProvider(
    env.OLLAMA_URL,
    modelOverride ?? env.OLLAMA_LLM_MODEL,
    env.OLLAMA_EMBED_MODEL,
    { temperature: env.OLLAMA_LLM_TEMPERATURE, seed: env.OLLAMA_LLM_SEED },
  );
}

// Main provider for generation + embeddings.
export const llmProvider: LLMProvider = createProvider();

// Separate provider for query rewriting — uses REWRITE_MODEL if set.
export const rewriteProvider: LLMProvider = env.REWRITE_MODEL
  ? createProvider(env.REWRITE_MODEL)
  : llmProvider;

export type { LLMProvider };
