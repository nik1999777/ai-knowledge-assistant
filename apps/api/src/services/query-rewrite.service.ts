import { rewriteProvider } from "../providers/index.js";
import type { ConversationTurn } from "./prompt.service.js";

// LangChain-style: rewrite follow-up as standalone using full previous turn.
const PROMPT_WITH_HISTORY = (question: string, turn: ConversationTurn) =>
  `Given the conversation below, rewrite the follow-up as a standalone question that does not need the conversation context to be understood. Output ONLY the rewritten question, nothing else.

User: ${turn.question}
Assistant: ${turn.answer.slice(0, 300)}

Follow-up: ${question}
Standalone:`;

const PROMPT_STANDALONE = (question: string) =>
  `Extract 3-7 key search terms from the question for database retrieval. Output ONLY the terms separated by spaces, nothing else.

Question: ${question}
Terms:`;

export async function rewriteQueryForSearch(
  question: string,
  previousTurn?: ConversationTurn,
): Promise<string> {
  try {
    const prompt = previousTurn
      ? PROMPT_WITH_HISTORY(question, previousTurn)
      : PROMPT_STANDALONE(question);

    const result = await rewriteProvider.generate(prompt);
    const cleaned = result.trim();

    if (!cleaned || cleaned.length > 300) return question;
    return cleaned;
  } catch {
    return question;
  }
}
