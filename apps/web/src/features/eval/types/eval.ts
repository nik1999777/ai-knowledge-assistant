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
  decision?: "answered" | "declined";
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
