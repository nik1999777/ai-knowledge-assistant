export type Source = {
  docId: string;
  title: string;
  sourceType?: "txt" | "md" | "pdf" | "docx";
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

export type Timing = {
  embeddingMs: number;
  searchMs: number;
  llmMs: number;
  totalMs: number;
};

export type RagDebug = {
  threshold: number;
  declineThreshold?: number;
  answerThreshold?: number;
  topK: number;
  decision: "answered" | "declined";
  lexicalCount?: number;
  mergedCount?: number;
  rerankedCount?: number;
  domainEvidence?: number;
  guardrailReason?: string;
  vectorCount?: number;
};

export type ChatResponse = {
  answer: string;
  sources: Source[];
  bestScore: number;
  timing: Timing;
  debug: RagDebug;
  sessionId: string;
};

export type ChatStreamMeta = Omit<ChatResponse, "answer">;

export type ChatExchangeStatus = "loading" | "success" | "error";

export type ChatExchange = {
  id: string;
  question: string;
  status: ChatExchangeStatus;
  createdAt: string;
  streamedAnswer?: string;
  response?: ChatResponse;
  errorMessage?: string;
};

export type ChatSessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatSessionDetailResponse = {
  session: ChatSessionSummary;
  exchanges: ChatExchange[];
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
