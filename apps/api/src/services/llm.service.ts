import { env } from "../config/env.js";
import { llmProvider } from "../providers/index.js";

export const LLM_GENERATION_OPTIONS = {
  temperature: env.OLLAMA_LLM_TEMPERATURE,
  seed: env.OLLAMA_LLM_SEED,
};

export function askLLM(prompt: string, system?: string): Promise<string> {
  return llmProvider.generate(prompt, system);
}

export function streamLLM(
  prompt: string,
  onChunk: (chunk: string) => void,
  system?: string,
): Promise<void> {
  return llmProvider.stream(prompt, onChunk, system);
}
