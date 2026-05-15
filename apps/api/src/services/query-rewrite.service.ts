import { env } from "../config/env.js";
import { postOllamaJson } from "../clients/ollama.client.js";

// Pronouns and filler words that carry no retrieval signal.
const NOISE_TOKENS = new Set([
  "он", "она", "оно", "они", "его", "её", "их", "себя", "ему", "ей", "им", "ими",
  "что", "где", "как", "кто", "чем", "когда", "зачем", "почему",
  "это", "тот", "та", "то", "там", "тут",
  "расскажи", "объясни", "покажи", "опиши", "скажи",
  "про", "про", "обо", "насчёт",
  "можешь", "можете", "пожалуйста",
  "ещё", "уже", "тоже", "также", "вот", "же", "бы", "ли",
  "его", "her", "him", "it", "its", "their", "they",
]);

const PROMPT_STANDALONE = (question: string) =>
  `Extract 3-7 key search terms from the question for database retrieval. Output ONLY the terms separated by spaces, nothing else.

Question: ${question}
Terms:`;

export async function rewriteQueryForSearch(
  question: string,
  previousQuestion?: string,
): Promise<string> {
  if (previousQuestion) {
    return mergeQueryTokens(previousQuestion, question);
  }

  return callLlmRewriter(question);
}

// For follow-up questions: merge meaningful tokens from both questions.
// This is more reliable than asking a small model to resolve pronouns.
function mergeQueryTokens(previousQuestion: string, question: string): string {
  const combined = `${previousQuestion} ${question}`;
  const tokens = combined
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !NOISE_TOKENS.has(t));

  const unique = [...new Set(tokens)];
  return unique.slice(0, 8).join(" ") || question;
}

async function callLlmRewriter(question: string): Promise<string> {
  try {
    const data = await postOllamaJson<{ response: string }>(
      "/api/generate",
      {
        model: env.OLLAMA_LLM_MODEL,
        prompt: PROMPT_STANDALONE(question),
        stream: false,
        options: {
          temperature: 0,
          seed: 42,
          num_predict: 40,
        },
      },
      "Query rewrite",
    );

    const cleaned = cleanLlmTerms(data.response);

    if (!cleaned || cleaned.length > 200) {
      return question;
    }

    return cleaned;
  } catch {
    return question;
  }
}

// Strip preamble noise like "Here are the key terms: " that small models add.
function cleanLlmTerms(raw: string): string {
  let text = raw.trim();

  // If the model added a colon-prefixed preamble, take everything after the last colon.
  const colonIdx = text.lastIndexOf(":");
  if (colonIdx !== -1 && colonIdx < text.length - 1) {
    const afterColon = text.slice(colonIdx + 1).trim();
    // Only use the post-colon part if it looks like actual terms (mostly word chars).
    if (/^[\p{L}\p{N}\s]+$/u.test(afterColon)) {
      text = afterColon;
    }
  }

  return text.trim();
}
