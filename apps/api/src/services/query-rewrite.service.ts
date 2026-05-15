import { env } from "../config/env.js";
import { postOllamaJson } from "../clients/ollama.client.js";

const PROMPT = (question: string, previousQuestion?: string) => {
  const context = previousQuestion
    ? `Previous question: ${previousQuestion}\n`
    : "";
  return `Extract 3-7 key search terms from the question below for database retrieval.
If the question contains pronouns or references (e.g. "it", "this", "that", "он", "она", "оно", "они", "это", "тот", "та", "то", "его", "её", "их"), resolve them using the previous question and replace with the actual subject.
Return ONLY the terms separated by spaces. No explanations, no punctuation, no numbering.

${context}Question: ${question}
Terms:`;
};

export async function rewriteQueryForSearch(
  question: string,
  previousQuestion?: string,
): Promise<string> {
  try {
    const data = await postOllamaJson<{ response: string }>(
      "/api/generate",
      {
        model: env.OLLAMA_LLM_MODEL,
        prompt: PROMPT(question, previousQuestion),
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
