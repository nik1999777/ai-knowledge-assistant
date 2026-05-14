import { env } from "../config/env.js";
import { postOllamaJson } from "../clients/ollama.client.js";

const PROMPT = (question: string) =>
  `Extract 3-7 key search terms from the question below for database retrieval.
Return ONLY the terms separated by spaces. No explanations, no punctuation, no numbering.

Question: ${question}
Terms:`;

export async function rewriteQueryForSearch(question: string): Promise<string> {
  try {
    const data = await postOllamaJson<{ response: string }>(
      "/api/generate",
      {
        model: env.OLLAMA_LLM_MODEL,
        prompt: PROMPT(question),
        stream: false,
        options: {
          temperature: 0,
          seed: 42,
          num_predict: 40,
        },
      },
      "Query rewrite",
    );

    const terms = data.response.trim();

    if (!terms || terms.length > 200) {
      return question;
    }

    return terms;
  } catch {
    return question;
  }
}
