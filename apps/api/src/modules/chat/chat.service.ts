import { env } from "../../config/env.js";
import { searchSimilar } from "../../clients/qdrant.client.js";
import {
  type DocumentScope,
  getExistingDocumentIdsByScope,
  searchDocumentChunksLexical,
} from "../../repositories/documents.repository.js";
import { getQueryEmbedding } from "../../services/embeddings.service.js";
import { rewriteQueryForSearch } from "../../services/query-rewrite.service.js";
import {
  LLM_GENERATION_OPTIONS,
  streamLLM,
} from "../../services/llm.service.js";
import {
  RAG_PROMPT_VERSION,
  buildRagPrompt,
  type RagAnswerMode,
} from "../../services/prompt.service.js";
import { measureTime } from "../../utils/timing.js";
import { tokenizeForSearch } from "../../utils/tokenization.js";

import type { ChatInput } from "./chat.schemas.js";
import type { ChatStreamMeta, RagSource, RetrievalTraceItem } from "./chat.types.js";

const TOP_K = env.TOP_K;
const DOMAIN_GUARDRAIL_SCORE = 0.8;
const MIN_DOMAIN_EVIDENCE = env.DOMAIN_EVIDENCE_THRESHOLD;
const MIN_TOKENS_FOR_EVIDENCE = 2;
const DECLINE_SCORE_THRESHOLD = env.DECLINE_SCORE_THRESHOLD;
const ANSWER_SCORE_THRESHOLD = env.ANSWER_SCORE_THRESHOLD;
const RRF_K = 60;
const RETRIEVAL_CANDIDATE_MULTIPLIER = 4;
const MAX_QUERY_TOKENS_FOR_COVERAGE = 6;
const MAX_SUPPORT_TERMS = 16;
const TRACE_ITEMS_PER_STAGE = 8;
const DECLINE_ANSWER = "Я не знаю на основе предоставленных данных.";

type StreamChunkHandler = (chunk: string) => void;

type RagChatContext = {
  bestScore: number;
  decisionThreshold: number;
  rewriteMs: number;
  searchQuery: string;
  embeddingMs: number;
  searchMs: number;
  domainEvidence: number;
  guardrailReason: string | null;
  lexicalCount: number;
  mergedCount: number;
  rerankedCount: number;
  sources: RagSource[];
  contextChunks: string[];
  retrievalTrace: NonNullable<ChatStreamMeta["debug"]["retrievalTrace"]>;
  vectorCount: number;
  shouldDecline: boolean;
};

export async function streamChatWithKnowledgeBase(
  input: ChatInput,
  onChunk: StreamChunkHandler,
  options: { documentScope?: DocumentScope } = {},
): Promise<{ answer: string; meta: Omit<ChatStreamMeta, "sessionId"> }> {
  const totalStart = performance.now();
  const context = await buildRagChatContext(input, {
    documentScope: options.documentScope ?? "user",
  });
  const answerMode: RagAnswerMode = input.answerMode ?? "balanced";

  if (context.shouldDecline) {
    const answer = DECLINE_ANSWER;
    const totalMs = Number((performance.now() - totalStart).toFixed(2));

    onChunk(answer);

    return {
      answer,
      meta: {
        sources: [],
        bestScore: context.bestScore,
        timing: {
          rewriteMs: context.rewriteMs,
          embeddingMs: context.embeddingMs,
          searchMs: context.searchMs,
          llmMs: 0,
          totalMs,
        },
        debug: {
          threshold: context.decisionThreshold,
          answerMode,
          declineThreshold: DECLINE_SCORE_THRESHOLD,
          answerThreshold: ANSWER_SCORE_THRESHOLD,
          promptVersion: RAG_PROMPT_VERSION,
          generationOptions: LLM_GENERATION_OPTIONS,
          topK: TOP_K,
          decision: "declined",
          domainEvidence: context.domainEvidence,
          guardrailReason: context.guardrailReason ?? "low_relevance",
          lexicalCount: context.lexicalCount,
          mergedCount: context.mergedCount,
          rerankedCount: context.rerankedCount,
          retrievalTrace: context.retrievalTrace,
          vectorCount: context.vectorCount,
          searchQuery: context.searchQuery,
        },
      },
    };
  }

  const prompt = buildRagPrompt(input.question, context.contextChunks, answerMode);
  const llmStart = performance.now();
  let answer = "";

  await streamLLM(prompt, (chunk) => {
    answer += chunk;
    onChunk(chunk);
  });

  answer = normalizeDeclineAnswer(answer);
  const answerSupport = analyzeAnswerSupport(answer, context.sources);

  const llmMs = Number((performance.now() - llmStart).toFixed(2));
  const totalMs = Number((performance.now() - totalStart).toFixed(2));

  return {
    answer,
    meta: {
      sources: context.sources,
      bestScore: context.bestScore,
      timing: {
        rewriteMs: context.rewriteMs,
        embeddingMs: context.embeddingMs,
        searchMs: context.searchMs,
        llmMs,
        totalMs,
      },
      debug: {
        threshold: context.decisionThreshold,
        answerMode,
        answerSupport,
        declineThreshold: DECLINE_SCORE_THRESHOLD,
        answerThreshold: ANSWER_SCORE_THRESHOLD,
        promptVersion: RAG_PROMPT_VERSION,
        generationOptions: LLM_GENERATION_OPTIONS,
        topK: TOP_K,
        decision: "answered",
        domainEvidence: context.domainEvidence,
        lexicalCount: context.lexicalCount,
        mergedCount: context.mergedCount,
        rerankedCount: context.rerankedCount,
        retrievalTrace: context.retrievalTrace,
        vectorCount: context.vectorCount,
        searchQuery: context.searchQuery,
      },
    },
  };
}

function normalizeDeclineAnswer(answer: string) {
  const normalized = answer.toLocaleLowerCase();

  if (normalized.includes("не знаю на основе предоставленных данных")) {
    return DECLINE_ANSWER;
  }

  return answer;
}

function analyzeAnswerSupport(answer: string, sources: RagSource[]) {
  const answerTerms = tokenizeForSearch(answer)
    .filter((token) => /[\p{L}]/u.test(token))
    .filter((token) => token.length >= 5)
    .slice(0, MAX_SUPPORT_TERMS);

  if (answerTerms.length === 0 || sources.length === 0) {
    return {
      matchedTerms: [],
      missingTerms: answerTerms,
      score: 0,
      status: "unsupported" as const,
    };
  }

  const sourceText = sources
    .map((source) => `${source.title}\n${source.section ?? ""}\n${source.text}`)
    .join("\n")
    .toLocaleLowerCase();
  const matchedTerms = answerTerms.filter((token) => sourceText.includes(token));
  const missingTerms = answerTerms.filter((token) => !sourceText.includes(token));
  const score = matchedTerms.length / answerTerms.length;

  return {
    matchedTerms,
    missingTerms,
    score: Number(score.toFixed(3)),
    status:
      score >= 0.8
        ? ("fully_supported" as const)
        : score >= 0.35
          ? ("partially_supported" as const)
          : ("unsupported" as const),
  };
}

async function buildRagChatContext(
  input: ChatInput,
  options: { documentScope: DocumentScope },
): Promise<RagChatContext> {
  const { result: searchQuery, ms: rewriteMs } = await measureTime(() =>
    rewriteQueryForSearch(input.question),
  );

  const { result: questionEmbedding, ms: embeddingMs } = await measureTime(() =>
    getQueryEmbedding(searchQuery),
  );

  const { result: rawResults, ms: searchMs } = await measureTime(() =>
    searchSimilar(
      questionEmbedding,
      TOP_K * RETRIEVAL_CANDIDATE_MULTIPLIER,
      options.documentScope,
    ),
  );

  const existingDocIds = await getExistingDocumentIdsByScope(
    rawResults
      .map((item) => item.payload?.docId)
      .filter((docId): docId is string => typeof docId === "string" && docId.length > 0),
    options.documentScope,
  );

  const vectorResults = rawResults.filter((item) => {
    const docId = item.payload?.docId;

    return typeof docId === "string" && existingDocIds.has(docId);
  });

  const vectorSources: RagSource[] = vectorResults.map((item, index) => ({
    docId: String(item.payload?.docId ?? ""),
    title: String(item.payload?.title ?? ""),
    sourceType:
      typeof item.payload?.sourceType === "string"
        ? (item.payload.sourceType as RagSource["sourceType"])
        : undefined,
    text: String(item.payload?.text ?? ""),
    chunkIndex: Number(item.payload?.chunkIndex ?? 0),
    chunkLen:
      typeof item.payload?.chunkLen === "number"
        ? item.payload.chunkLen
        : undefined,
    startOffset:
      typeof item.payload?.startOffset === "number"
        ? item.payload.startOffset
        : undefined,
    endOffset:
      typeof item.payload?.endOffset === "number"
        ? item.payload.endOffset
        : undefined,
    section:
      typeof item.payload?.section === "string" ? item.payload.section : null,
    score: item.score ?? 0,
    origin: "vector",
    vectorRank: index + 1,
    vectorScore: item.score ?? 0,
  }));

  const lexicalChunks = await searchDocumentChunksLexical(
    searchQuery,
    TOP_K * RETRIEVAL_CANDIDATE_MULTIPLIER,
    options.documentScope,
  );
  const lexicalSources = buildLexicalSources(input.question, lexicalChunks);
  const mergedSources = fuseSourcesWithRrf(vectorSources, lexicalSources);
  const allRerankedSources = rerankSources(input.question, mergedSources);
  const rerankedSources = allRerankedSources.slice(0, TOP_K);
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
    rewriteMs,
    searchQuery,
    embeddingMs,
    searchMs,
    domainEvidence,
    guardrailReason: decision.reason,
    lexicalCount: lexicalSources.length,
    mergedCount: mergedSources.length,
    rerankedCount: rerankedSources.length,
    retrievalTrace: {
      final: buildTraceItems(rerankedSources),
      lexical: buildTraceItems(lexicalSources),
      merged: buildTraceItems(mergedSources),
      reranked: buildTraceItems(allRerankedSources),
      vector: buildTraceItems(vectorSources),
    },
    sources: rerankedSources,
    contextChunks: rerankedSources.map(formatPromptContextChunk),
    vectorCount: vectorSources.length,
    shouldDecline: decision.shouldDecline,
  };
}

function buildTraceItems(sources: RagSource[]): RetrievalTraceItem[] {
  return sources.slice(0, TRACE_ITEMS_PER_STAGE).map((source) => ({
    docId: source.docId,
    title: source.title,
    chunkIndex: source.chunkIndex,
    origin: source.origin,
    vectorRank: source.vectorRank,
    vectorScore: source.vectorScore,
    lexicalRank: source.lexicalRank,
    lexicalScore: source.lexicalScore,
    rrfScore: source.rrfScore,
    finalScore: source.finalScore,
    score: source.score,
    section: source.section,
    textPreview: createPreview(source.text, 220),
  }));
}

function createPreview(value: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function formatPromptContextChunk(source: RagSource) {
  return [
    `Источник: ${source.title}`,
    source.section ? `Раздел: ${source.section}` : null,
    `Chunk: ${source.chunkIndex}`,
    "Текст:",
    source.text,
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n");
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

  if (input.lowEvidence) {
    return { shouldDecline: true, reason: "low_domain_evidence_mid_band" } as const;
  }

  if (input.bestScore >= ANSWER_SCORE_THRESHOLD) {
    return { shouldDecline: false, reason: null } as const;
  }

  return { shouldDecline: false, reason: null } as const;
}

function buildLexicalSources(
  question: string,
  chunks: import("../../repositories/documents.repository.js").LexicalChunkMatch[],
): RagSource[] {
  const tokens = tokenizeForSearch(question);

  return chunks
    .map((chunk, index) => {
      const overlap = tokenOverlapScore(tokens, chunk.chunkText);
      const titleOverlap = tokenOverlapScore(tokens, chunk.title);
      const sectionOverlap = chunk.section
        ? tokenOverlapScore(tokens, chunk.section)
        : 0;
      const scopedSectionOverlap = titleOverlap > 0 ? sectionOverlap : 0;
      const rankScore = Math.min(1, chunk.lexicalRank * 3);
      const score = Number(
        (
          0.38 +
          overlap * 0.32 +
          titleOverlap * 0.18 +
          scopedSectionOverlap * 0.12 +
          rankScore * 0.12
        ).toFixed(3),
      );

      return {
        docId: chunk.docId,
        title: chunk.title,
        sourceType: chunk.sourceType,
        text: chunk.chunkText,
        chunkIndex: chunk.chunkIndex,
        chunkLen: chunk.chunkLen,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        section: chunk.section,
        score,
        origin: "lexical" as const,
        lexicalRank: index + 1,
        lexicalScore: score,
      };
    })
    .filter((s) => s.score > 0.38);
}

function fuseSourcesWithRrf(vectorSources: RagSource[], lexicalSources: RagSource[]) {
  const byKey = new Map<string, RagSource>();

  for (const source of vectorSources) {
    const key = `${source.docId}:${source.chunkIndex}`;
    byKey.set(key, source);
  }

  for (const source of lexicalSources) {
    const key = `${source.docId}:${source.chunkIndex}`;
    const current = byKey.get(key);

    if (!current) {
      byKey.set(key, source);
      continue;
    }

    byKey.set(key, {
      ...current,
      origin: "hybrid",
      lexicalRank: source.lexicalRank,
      lexicalScore: source.lexicalScore,
      score: Math.max(current.score, source.score),
    });
  }

  const maxRrfScore = 2 / (RRF_K + 1);

  return [...byKey.values()]
    .map((source) => {
      const vectorRrf =
        typeof source.vectorRank === "number" ? 1 / (RRF_K + source.vectorRank) : 0;
      const lexicalRrf =
        typeof source.lexicalRank === "number"
          ? 1 / (RRF_K + source.lexicalRank)
          : 0;
      const rrfScore = (vectorRrf + lexicalRrf) / maxRrfScore;
      const rawScore = Math.max(source.vectorScore ?? 0, source.lexicalScore ?? 0);
      const fusedScore = clampScore(rawScore * 0.82 + rrfScore * 0.18);

      return {
        ...source,
        rrfScore: Number(rrfScore.toFixed(3)),
        score: Number(fusedScore.toFixed(3)),
      };
    })
    .sort((left, right) => {
      if ((right.rrfScore ?? 0) !== (left.rrfScore ?? 0)) {
        return (right.rrfScore ?? 0) - (left.rrfScore ?? 0);
      }

      return right.score - left.score;
    });
}

function tokenOverlapScore(tokens: string[], text: string) {
  if (tokens.length === 0) {
    return 0;
  }

  const normalizedText = text.toLocaleLowerCase();
  const matched = tokens.filter((token) => normalizedText.includes(token)).length;
  const denominator = Math.min(tokens.length, MAX_QUERY_TOKENS_FOR_COVERAGE);

  return Math.min(1, matched / denominator);
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
      const scopedSectionOverlap = titleOverlap > 0 ? sectionOverlap : 0;
      const metadataCoverage = Math.max(titleOverlap, scopedSectionOverlap);
      const phraseBonus =
        normalizedQuestion.length >= 8 &&
        searchable.toLocaleLowerCase().includes(normalizedQuestion)
          ? 0.05
          : 0;
      const shortPenalty = (source.chunkLen ?? source.text.length) < 80 ? -0.02 : 0;

      const rerankedScore = clampScore(
        source.score +
          overlap * 0.06 +
          titleOverlap * 0.08 +
          scopedSectionOverlap * 0.08 +
          metadataCoverage * 0.03 +
          phraseBonus +
          shortPenalty,
      );

      return {
        ...source,
        score: Number(rerankedScore.toFixed(3)),
        finalScore: Number(rerankedScore.toFixed(3)),
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
