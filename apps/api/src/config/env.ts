import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  WEB_ORIGIN: z.url().default("http://localhost:5173"),

  // LLM provider: "ollama" (default, local) or "openai"
  LLM_PROVIDER: z.enum(["ollama", "openai"]).default("ollama"),

  // Ollama — used when LLM_PROVIDER=ollama
  OLLAMA_URL: z.url().default("http://localhost:11434"),
  OLLAMA_LLM_MODEL: z.string().default("llama3"),
  OLLAMA_EMBED_MODEL: z.string().default("nomic-embed-text"),

  // OpenAI — used when LLM_PROVIDER=openai
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_LLM_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_EMBED_MODEL: z.string().default("text-embedding-3-small"),

  // Optional: separate faster model for query rewriting (any provider)
  REWRITE_MODEL: z.string().optional(),

  OLLAMA_LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0),
  OLLAMA_LLM_SEED: z.coerce.number().int().default(42),

  QDRANT_URL: z.url(),
  POSTGRES_URL: z.string().min(1),
  RELEVANCE_THRESHOLD: z.coerce.number().default(0.714),
  DECLINE_SCORE_THRESHOLD: z.coerce.number().default(0.45),
  ANSWER_SCORE_THRESHOLD: z.coerce.number().default(0.47),
  DOMAIN_EVIDENCE_THRESHOLD: z.coerce.number().default(0.34),
  TOP_K: z.coerce.number().int().default(3),
});

export const env = envSchema.parse(process.env);
