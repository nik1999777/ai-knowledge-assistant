import { env } from "../config/env.js";
import { postOllamaJson } from "../clients/ollama.client.js";

const PROMPT_WITH_HISTORY = (question: string, previousQuestion: string) =>
  `Rewrite the follow-up question as a standalone search query by replacing all pronouns and references with the actual subject from the previous question. Then output only 3-7 key search terms separated by spaces.

Examples:
Previous: Что такое PyTorch?
Follow-up: А где он используется?
Terms: PyTorch применение использование области

Previous: Расскажи про React
Follow-up: Каковы его преимущества?
Terms: React преимущества возможности плюсы

Previous: Что такое gradient descent?
Follow-up: Как это работает?
Terms: gradient descent алгоритм работа шаги

Previous: ${previousQuestion}
Follow-up: ${question}
Terms:`;

const PROMPT_STANDALONE = (question: string) =>
  `Extract 3-7 key search terms from the question for database retrieval. Return ONLY the terms separated by spaces.

Question: ${question}
Terms:`;

export async function rewriteQueryForSearch(
  question: string,
  previousQuestion?: string,
): Promise<string> {
  try {
    const data = await postOllamaJson<{ response: string }>(
      "/api/generate",
      {
        model: env.OLLAMA_LLM_MODEL,
        prompt: previousQuestion
          ? PROMPT_WITH_HISTORY(question, previousQuestion)
          : PROMPT_STANDALONE(question),
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
