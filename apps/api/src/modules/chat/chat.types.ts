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
  embeddingMs: number;
  searchMs: number;
  llmMs: number;
  totalMs: number;
};

export type RagDebug = {
  answerMode?: "strict" | "balanced" | "tutor";
  threshold: number;
  declineThreshold?: number;
  answerThreshold?: number;
  promptVersion?: string;
  generationOptions?: {
    temperature: number;
    seed: number;
  };
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
