import { llmProvider } from "../providers/index.js";

export function getQueryEmbedding(text: string): Promise<number[]> {
  return llmProvider.embed(`search_query: ${text}`);
}

export function getDocumentEmbedding(text: string): Promise<number[]> {
  return llmProvider.embed(`search_document: ${text}`);
}

export const getEmbedding = getDocumentEmbedding;
