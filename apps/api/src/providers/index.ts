import { env } from "../config/env.js";
import type { LLMProvider } from "./llm.provider.js";
import { OllamaProvider } from "./ollama.provider.js";
import { OpenAIProvider } from "./openai.provider.js";

type ProviderType = "ollama" | "openai";

function createProvider(type: ProviderType, modelOverride?: string): LLMProvider {
  if (type === "openai") {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required when provider=openai");

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
export const llmProvider: LLMProvider = createProvider(env.LLM_PROVIDER);

// Rewrite provider — can be a different type and/or model from the main provider.
// Example: LLM_PROVIDER=ollama + REWRITE_PROVIDER=openai + OPENAI_API_KEY=sk-...
const rewriteProviderType = env.REWRITE_PROVIDER ?? env.LLM_PROVIDER;
export const rewriteProvider: LLMProvider =
  rewriteProviderType === env.LLM_PROVIDER && !env.REWRITE_MODEL
    ? llmProvider
    : createProvider(rewriteProviderType, env.REWRITE_MODEL);

export type { LLMProvider };
