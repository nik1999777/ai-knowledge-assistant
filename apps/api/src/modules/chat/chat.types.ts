export type RagSource = {
  docId: string;
  title: string;
  sourceType?: "txt" | "md" | "pdf" | "docx" | "csv" | "zip";
  text: string;
  chunkIndex: number;
  chunkLen?: number;
  startOffset?: number;
  endOffset?: number;
  section?: string | null;
  origin?: "vector" | "lexical" | "hybrid";
  vectorRank?: number;
  vectorScore?: number;
  lexicalRank?: number;
  lexicalScore?: number;
  rrfScore?: number;
  finalScore?: number;
  score: number;
};

export type RagTiming = {
  rewriteMs?: number;
  embeddingMs: number;
  searchMs: number;
  llmMs: number;
  totalMs: number;
};

export type RetrievalTraceItem = {
  docId: string;
  title: string;
  chunkIndex: number;
  origin?: "vector" | "lexical" | "hybrid";
  vectorRank?: number;
  vectorScore?: number;
  lexicalRank?: number;
  lexicalScore?: number;
  rrfScore?: number;
  finalScore?: number;
  score: number;
  section?: string | null;
  textPreview: string;
};

export type RagDebug = {
  answerMode?: "strict" | "balanced" | "tutor";
  answerSupport?: {
    matchedTerms: string[];
    missingTerms: string[];
    score: number;
    status: "fully_supported" | "partially_supported" | "unsupported";
  };
  threshold: number;
  declineThreshold?: number;
  answerThreshold?: number;
  promptVersion?: string;
  generationOptions?: {
    temperature: number;
    seed: number;
  };
  retrievalTrace?: {
    final: RetrievalTraceItem[];
    lexical: RetrievalTraceItem[];
    merged: RetrievalTraceItem[];
    reranked: RetrievalTraceItem[];
    vector: RetrievalTraceItem[];
  };
  topK: number;
  decision: "answered" | "declined";
  lexicalCount?: number;
  mergedCount?: number;
  rerankedCount?: number;
  domainEvidence?: number;
  guardrailReason?: string;
  vectorCount?: number;
  searchQuery?: string;
};

export type ChatResponse = {
  answer: string;
  sources: RagSource[];
  bestScore: number;
  timing: RagTiming;
  debug: RagDebug;
  sessionId: string;
};

export type ChatStreamMeta = Omit<ChatResponse, "answer">;

export type ChatSessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatExchangeRecord = {
  id: string;
  question: string;
  status: "success";
  createdAt: string;
  response: ChatResponse;
};

export type ChatSessionDetailResponse = {
  session: ChatSessionSummary;
  exchanges: ChatExchangeRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalExchanges: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type ChatSessionsResponse = {
  sessions: ChatSessionSummary[];
};
