import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  WEB_ORIGIN: z.url().default("http://localhost:5173"),
  OLLAMA_URL: z.url(),
  QDRANT_URL: z.url(),
  POSTGRES_URL: z.string().min(1),
  OLLAMA_LLM_MODEL: z.string(),
  OLLAMA_EMBED_MODEL: z.string(),
  RELEVANCE_THRESHOLD: z.coerce.number().default(0.714),
  DECLINE_SCORE_THRESHOLD: z.coerce.number().default(0.45),
  ANSWER_SCORE_THRESHOLD: z.coerce.number().default(0.47),
  DOMAIN_EVIDENCE_THRESHOLD: z.coerce.number().default(0.34),
  TOP_K: z.coerce.number().int().default(3),
});

export const env = envSchema.parse(process.env);
