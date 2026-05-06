export type EvalConfusion = {
  tp: number;
  tn: number;
  fp: number;
  fn: number;
};

export type EvalCategorySummary = {
  category: string;
  total: number;
  correct: number;
  accuracy: number;
  declined: number;
  declineRate: number;
  avgBestScore: number;
  confusion: EvalConfusion;
};

export type EvalCaseResult = {
  id: string;
  category?: string;
  question: string;
  answer: string;
  declined: boolean;
  declineReason?: "model" | "policy" | null;
  decision?: "answered" | "declined";
  policyDeclined?: boolean;
  modelDeclined?: boolean;
  bestScore: number;
  domainEvidence?: number;
  guardrailReason?: string | null;
  lexicalCount: number;
  mergedCount: number;
  sourceCount: number;
  vectorCount: number;
  expectedAnswerable: boolean;
  answerKeywordHit: boolean | null;
  sourceKeywordHit: boolean | null;
  answerabilityCorrect: boolean;
  sources?: Array<{
    docId: string;
    title: string;
    chunkIndex: number;
    score: number;
    origin?: "vector" | "lexical" | "hybrid";
    vectorRank?: number;
    vectorScore?: number;
    lexicalRank?: number;
    lexicalScore?: number;
    rrfScore?: number;
    finalScore?: number;
    section?: string | null;
    textPreview: string;
  }>;
};

export type EvalReport = {
  generatedAt: string;
  summary: {
    total: number;
    answered: number;
    declined: number;
    answerableRate: number;
    declineRate: number;
    avgBestScore: number;
    avgVectorCount: number;
    avgLexicalCount: number;
    avgMergedCount: number;
    avgDomainEvidence?: number;
    policyDeclined?: number;
    modelDeclined?: number;
    modelDeclinedAfterPolicyAnswer?: number;
    answerabilityAccuracy: number;
    confusion: EvalConfusion;
    categorySummary?: EvalCategorySummary[];
    answerKeywordHitRate: number | null;
    sourceKeywordHitRate: number | null;
    recommendedThreshold: {
      threshold: number;
      accuracy: number;
      answered: number;
      declined: number;
    };
    recommendedDualThreshold: {
      declineThreshold: number;
      answerThreshold: number;
      accuracy: number;
      answered: number;
      declined: number;
      confusion: EvalConfusion;
    };
  };
  results: EvalCaseResult[];
};
