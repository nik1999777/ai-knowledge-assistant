import { env } from "../../config/env.js";
import { searchSimilar } from "../../clients/qdrant.client.js";
import {
  getExistingDocumentIds,
  searchDocumentsLexical,
} from "../../repositories/documents.repository.js";
import { chunkDocument } from "../../services/chunk.service.js";
import { getEmbedding } from "../../services/embeddings.service.js";
import { streamLLM } from "../../services/llm.service.js";
import { buildRagPrompt } from "../../services/prompt.service.js";
import { measureTime } from "../../utils/timing.js";
import { tokenizeForSearch } from "../../utils/tokenization.js";

import type { ChatInput } from "./chat.schemas.js";
import type { ChatStreamMeta, RagSource } from "./chat.types.js";

const TOP_K = env.TOP_K;
const DOMAIN_GUARDRAIL_SCORE = 0.8;
const MIN_DOMAIN_EVIDENCE = env.DOMAIN_EVIDENCE_THRESHOLD;
const MIN_TOKENS_FOR_EVIDENCE = 2;
const DECLINE_SCORE_THRESHOLD = env.DECLINE_SCORE_THRESHOLD;
const ANSWER_SCORE_THRESHOLD = env.ANSWER_SCORE_THRESHOLD;

type StreamChunkHandler = (chunk: string) => void;

type RagChatContext = {
  bestScore: number;
  decisionThreshold: number;
  embeddingMs: number;
  searchMs: number;
  domainEvidence: number;
  guardrailReason: string | null;
  lexicalCount: number;
  mergedCount: number;
  rerankedCount: number;
  sources: RagSource[];
  contextChunks: string[];
  vectorCount: number;
  shouldDecline: boolean;
};

export async function streamChatWithKnowledgeBase(
  input: ChatInput,
  onChunk: StreamChunkHandler,
): Promise<{ answer: string; meta: Omit<ChatStreamMeta, "sessionId"> }> {
  const totalStart = performance.now();
  const context = await buildRagChatContext(input);

  if (context.shouldDecline) {
    const answer = "Я не знаю на основе предоставленных данных.";
    const totalMs = Number((performance.now() - totalStart).toFixed(2));

    onChunk(answer);

    return {
      answer,
      meta: {
        sources: [],
        bestScore: context.bestScore,
        timing: {
          embeddingMs: context.embeddingMs,
          searchMs: context.searchMs,
          llmMs: 0,
          totalMs,
        },
        debug: {
          threshold: context.decisionThreshold,
          declineThreshold: DECLINE_SCORE_THRESHOLD,
          answerThreshold: ANSWER_SCORE_THRESHOLD,
          topK: TOP_K,
          decision: "declined",
          domainEvidence: context.domainEvidence,
          guardrailReason: context.guardrailReason ?? "low_relevance",
          lexicalCount: context.lexicalCount,
          mergedCount: context.mergedCount,
          rerankedCount: context.rerankedCount,
          vectorCount: context.vectorCount,
        },
      },
    };
  }

  const prompt = buildRagPrompt(input.question, context.contextChunks);
  const llmStart = performance.now();
  let answer = "";

  await streamLLM(prompt, (chunk) => {
    answer += chunk;
    onChunk(chunk);
  });

  const llmMs = Number((performance.now() - llmStart).toFixed(2));
  const totalMs = Number((performance.now() - totalStart).toFixed(2));

  return {
    answer,
    meta: {
      sources: context.sources,
      bestScore: context.bestScore,
      timing: {
        embeddingMs: context.embeddingMs,
        searchMs: context.searchMs,
        llmMs,
        totalMs,
      },
      debug: {
        threshold: context.decisionThreshold,
        declineThreshold: DECLINE_SCORE_THRESHOLD,
        answerThreshold: ANSWER_SCORE_THRESHOLD,
        topK: TOP_K,
        decision: "answered",
        domainEvidence: context.domainEvidence,
        lexicalCount: context.lexicalCount,
        mergedCount: context.mergedCount,
        rerankedCount: context.rerankedCount,
        vectorCount: context.vectorCount,
      },
    },
  };
}

async function buildRagChatContext(input: ChatInput): Promise<RagChatContext> {
  const { result: questionEmbedding, ms: embeddingMs } = await measureTime(() =>
    getEmbedding(input.question),
  );

  const { result: rawResults, ms: searchMs } = await measureTime(() =>
    searchSimilar(questionEmbedding, TOP_K * 2),
  );

  const existingDocIds = await getExistingDocumentIds(
    rawResults
      .map((item) => item.payload?.docId)
      .filter((docId): docId is string => typeof docId === "string" && docId.length > 0),
  );

  const vectorResults = rawResults.filter((item) => {
    const docId = item.payload?.docId;

    return typeof docId === "string" && existingDocIds.has(docId);
  });

  const vectorSources: RagSource[] = vectorResults.map((item) => ({
    docId: String(item.payload?.docId ?? ""),
    title: String(item.payload?.title ?? ""),
    sourceType:
      typeof item.payload?.sourceType === "string"
        ? (item.payload.sourceType as "txt" | "md" | "pdf" | "docx")
        : undefined,
    text: String(item.payload?.text ?? ""),
    chunkIndex: Number(item.payload?.chunkIndex ?? 0),
    chunkLen:
      typeof item.payload?.chunkLen === "number"
        ? item.payload.chunkLen
        : undefined,
    section:
      typeof item.payload?.section === "string" ? item.payload.section : null,
    score: item.score ?? 0,
  }));

  const lexicalDocuments = await searchDocumentsLexical(input.question, TOP_K * 2);
  const lexicalSources = buildLexicalSources(input.question, lexicalDocuments, TOP_K * 2);
  const mergedSources = mergeSources(vectorSources, lexicalSources).slice(0, TOP_K * 2);
  const rerankedSources = rerankSources(input.question, mergedSources).slice(0, TOP_K);
  const bestScore = rerankedSources[0]?.score ?? 0;
  const questionTokens = tokenizeForSearch(input.question);
  const domainEvidence = calculateDomainEvidence(questionTokens, rerankedSources);
  const lowEvidence =
    questionTokens.length >= MIN_TOKENS_FOR_EVIDENCE &&
    domainEvidence < MIN_DOMAIN_EVIDENCE &&
    bestScore < DOMAIN_GUARDRAIL_SCORE;
  const decision = decideAnswerability({
    bestScore,
    hasSources: rerankedSources.length > 0,
    lowEvidence,
    lexicalCount: lexicalSources.length,
    vectorCount: vectorSources.length,
  });

  return {
    bestScore,
    decisionThreshold: ANSWER_SCORE_THRESHOLD,
    embeddingMs,
    searchMs,
    domainEvidence,
    guardrailReason: decision.reason,
    lexicalCount: lexicalSources.length,
    mergedCount: mergedSources.length,
    rerankedCount: rerankedSources.length,
    sources: rerankedSources,
    contextChunks: rerankedSources.map((item) => item.text),
    vectorCount: vectorSources.length,
    shouldDecline: decision.shouldDecline,
  };
}

function decideAnswerability(input: {
  bestScore: number;
  hasSources: boolean;
  lowEvidence: boolean;
  lexicalCount: number;
  vectorCount: number;
}) {
  if (!input.hasSources) {
    return { shouldDecline: true, reason: "no_sources" } as const;
  }

  if (input.bestScore < DECLINE_SCORE_THRESHOLD) {
    return { shouldDecline: true, reason: "score_below_decline_threshold" } as const;
  }

  if (input.bestScore >= ANSWER_SCORE_THRESHOLD) {
    return { shouldDecline: false, reason: null } as const;
  }

  const hasHybridEvidence = input.lexicalCount > 0 || input.vectorCount > 1;

  if (input.lowEvidence && !hasHybridEvidence) {
    return { shouldDecline: true, reason: "low_domain_evidence_mid_band" } as const;
  }

  return { shouldDecline: false, reason: null } as const;
}

function buildLexicalSources(
  question: string,
  documents: Array<{
    docId: string;
    title: string;
    sourceType: "txt" | "md" | "pdf" | "docx";
    textContent: string;
    lexicalRank: number;
  }>,
  limit: number,
) {
  const tokens = tokenizeForSearch(question);
  const sources: RagSource[] = [];

  for (const document of documents) {
    const chunks = chunkDocument(document.textContent);

    for (const chunk of chunks) {
      const overlap = tokenOverlapScore(tokens, chunk.text);

      if (overlap === 0) {
        continue;
      }

      const rankScore = Math.min(1, document.lexicalRank * 3);
      const score = Number((0.45 + overlap * 0.35 + rankScore * 0.2).toFixed(3));

      sources.push({
        docId: document.docId,
        title: document.title,
        sourceType: document.sourceType,
        text: chunk.text,
        chunkIndex: chunk.chunkIndex,
        chunkLen: chunk.chunkLen,
        section: chunk.section,
        score,
      });
    }
  }

  return sources.sort((left, right) => right.score - left.score).slice(0, limit);
}

function mergeSources(vectorSources: RagSource[], lexicalSources: RagSource[]) {
  const byKey = new Map<string, RagSource>();

  for (const source of [...vectorSources, ...lexicalSources]) {
    const key = `${source.docId}:${source.chunkIndex}`;
    const current = byKey.get(key);

    if (!current || source.score > current.score) {
      byKey.set(key, source);
    }
  }

  return [...byKey.values()].sort((left, right) => right.score - left.score);
}

function tokenOverlapScore(tokens: string[], text: string) {
  if (tokens.length === 0) {
    return 0;
  }

  const normalizedText = text.toLocaleLowerCase();
  const matched = tokens.filter((token) => normalizedText.includes(token)).length;

  return matched / tokens.length;
}

function calculateDomainEvidence(tokens: string[], sources: RagSource[]) {
  if (tokens.length === 0 || sources.length === 0) {
    return 0;
  }

  const searchable = sources
    .map((source) => `${source.title}\n${source.section ?? ""}\n${source.text}`)
    .join("\n")
    .toLocaleLowerCase();

  const matched = tokens.filter((token) => searchable.includes(token)).length;

  return matched / tokens.length;
}

function rerankSources(question: string, sources: RagSource[]) {
  const tokens = tokenizeForSearch(question);
  const normalizedQuestion = question.toLocaleLowerCase().trim();

  return sources
    .map((source) => {
      const searchable = `${source.title}\n${source.section ?? ""}\n${source.text}`;
      const overlap = tokenOverlapScore(tokens, searchable);
      const titleOverlap = tokenOverlapScore(tokens, source.title);
      const sectionOverlap = source.section
        ? tokenOverlapScore(tokens, source.section)
        : 0;
      const phraseBonus =
        normalizedQuestion.length >= 8 &&
        searchable.toLocaleLowerCase().includes(normalizedQuestion)
          ? 0.05
          : 0;
      const shortPenalty = (source.chunkLen ?? source.text.length) < 80 ? -0.02 : 0;

      const rerankedScore = clampScore(
        source.score +
          overlap * 0.06 +
          titleOverlap * 0.03 +
          sectionOverlap * 0.02 +
          phraseBonus +
          shortPenalty,
      );

      return {
        ...source,
        score: Number(rerankedScore.toFixed(3)),
      };
    })
    .sort((left, right) => right.score - left.score);
}

function clampScore(value: number) {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}
