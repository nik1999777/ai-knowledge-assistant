import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { streamChatWithKnowledgeBase } from "../modules/chat/chat.service.js";
import type { DocumentScope } from "../repositories/documents.repository.js";
import { initCollection } from "../clients/qdrant.client.js";
import { initPostgres } from "../db/postgres.client.js";
import { runMigrations } from "../db/migrator.js";

type EvalCase = {
  id: string;
  category?: EvalCategory;
  question: string;
  expected: {
    answerable: boolean;
    answerKeywords?: string[];
    evidenceQuote?: string;
    sourceKeywords?: string[];
  };
  generated?: GeneratedEvalMetadata;
};

type GeneratedEvalMetadata = {
  docId: string;
  title: string;
  chunkIndex: number;
  section?: string | null;
  startOffset?: number;
  endOffset?: number;
};

type EvalCategory =
  | "answerable"
  | "broad"
  | "exact"
  | "multi-hop"
  | "tricky"
  | "unanswerable";

type EvalSourceSnapshot = {
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
  startOffset?: number;
  endOffset?: number;
  textPreview: string;
};

type RunRagEvalOptions = {
  allowedSourceDocIds?: Set<string>;
  datasetPath: string;
  documentScope?: DocumentScope;
  label?: string;
  reportPath: string;
};

type EvalCaseResult = {
  id: string;
  category: EvalCategory;
  question: string;
  answer: string;
  declined: boolean;
  declineReason: "model" | "policy" | null;
  decision: "answered" | "declined";
  policyDeclined: boolean;
  modelDeclined: boolean;
  promptVersion: string | null;
  generationOptions: {
    temperature: number;
    seed: number;
  } | null;
  bestScore: number;
  domainEvidence: number;
  guardrailReason: string | null;
  lexicalCount: number;
  mergedCount: number;
  sourceCount: number;
  vectorCount: number;
  expectedAnswerable: boolean;
  expectedEvidenceQuote: string | null;
  generated?: GeneratedEvalMetadata;
  answerKeywordHit: boolean | null;
  sourceKeywordHit: boolean | null;
  answerabilityCorrect: boolean;
  sources: EvalSourceSnapshot[];
};

const DECLINE_ANSWER = "Я не знаю на основе предоставленных данных.";
const DECLINE_ANSWER_VARIANTS = [
  DECLINE_ANSWER,
  "Не знаю на основе предоставленных данных",
  "Не знаю на основе предоставленных данных.",
];

async function main() {
  const datasetPath = path.resolve(
    process.cwd(),
    "../..",
    "test-data/rag-eval/questions.json",
  );
  const reportDir = path.resolve(process.cwd(), "../..", "test-data/rag-eval");
  const reportPath = path.join(reportDir, "last-report.json");

  await initPostgres();
  await runMigrations();
  await initCollection();

  await runRagEval({
    datasetPath,
    reportPath,
    label: "eval",
  });
}

export async function runRagEval(options: RunRagEvalOptions) {
  const dataset = await loadDataset(options.datasetPath);

  if (dataset.length === 0) {
    throw new Error("Eval dataset пустой: добавьте вопросы в questions.json");
  }

  console.log(`[${options.label ?? "eval"}] started, cases=${dataset.length}`);

  const results: EvalCaseResult[] = [];

  for (const testCase of dataset) {
    const result = await evaluateCase(testCase, options);
    results.push(result);
    console.log(
      `[${options.label ?? "eval"}] ${testCase.id} bestScore=${result.bestScore.toFixed(3)} declined=${result.declined} policy=${result.policyDeclined} model=${result.modelDeclined}`,
    );
  }

  const summary = buildSummary(results);
  const payload = {
    generatedAt: new Date().toISOString(),
    summary,
    results,
  };

  await mkdir(path.dirname(options.reportPath), { recursive: true });
  await writeFile(options.reportPath, JSON.stringify(payload, null, 2), "utf-8");

  console.log(`[${options.label ?? "eval"}] done`);
  console.log(
    `[${options.label ?? "eval"}] answerability_accuracy=${summary.answerabilityAccuracy.toFixed(3)} answerable_rate=${summary.answerableRate.toFixed(3)} decline_rate=${summary.declineRate.toFixed(3)} avg_best_score=${summary.avgBestScore.toFixed(3)} avg_vector=${summary.avgVectorCount.toFixed(2)} avg_lexical=${summary.avgLexicalCount.toFixed(2)} avg_merged=${summary.avgMergedCount.toFixed(2)} fp=${summary.confusion.fp} fn=${summary.confusion.fn} tp=${summary.confusion.tp} tn=${summary.confusion.tn} recommended_threshold=${summary.recommendedThreshold.threshold.toFixed(3)} recommended_accuracy=${summary.recommendedThreshold.accuracy.toFixed(3)} dual_decline=${summary.recommendedDualThreshold.declineThreshold.toFixed(3)} dual_answer=${summary.recommendedDualThreshold.answerThreshold.toFixed(3)} dual_accuracy=${summary.recommendedDualThreshold.accuracy.toFixed(3)}`,
  );
  console.log(`[${options.label ?? "eval"}] report: ${options.reportPath}`);
}

async function evaluateCase(
  testCase: EvalCase,
  options: Pick<RunRagEvalOptions, "allowedSourceDocIds" | "documentScope"> = {},
): Promise<EvalCaseResult> {
  let answer = "";

  const { answer: finalAnswer, meta } = await streamChatWithKnowledgeBase(
    {
      question: testCase.question,
    },
    (chunk) => {
      answer += chunk;
    },
    {
      documentScope: options.documentScope ?? "user",
    },
  );

  answer = finalAnswer;

  const decisionDeclined = meta.debug.decision === "declined";
  const answerDeclined = isDeclineAnswer(answer);
  const allowedSources = options.allowedSourceDocIds
    ? meta.sources.filter((source) => options.allowedSourceDocIds?.has(source.docId))
    : meta.sources;
  const sourceCount = allowedSources.length;
  const sourceText = allowedSources
    .map((source) => `${source.title}\n${source.text}`)
    .join("\n");
  const hasAllowedSources = !options.allowedSourceDocIds || sourceCount > 0;
  const answerKeywordHit = hasKeywordHit(
    answer,
    testCase.expected.answerKeywords ?? [],
  );
  const sourceKeywordHit = hasKeywordHit(
    sourceText,
    testCase.expected.sourceKeywords ?? [],
  );
  const declined = !hasAllowedSources || decisionDeclined || answerDeclined;

  return {
    id: testCase.id,
    category: testCase.category ?? inferCategory(testCase),
    question: testCase.question,
    answer,
    declined,
    declineReason: !hasAllowedSources
      ? "policy"
      : decisionDeclined
        ? "policy"
        : answerDeclined
          ? "model"
          : null,
    decision: meta.debug.decision,
    policyDeclined: decisionDeclined,
    modelDeclined: answerDeclined,
    promptVersion: meta.debug.promptVersion ?? null,
    generationOptions: meta.debug.generationOptions ?? null,
    bestScore: meta.bestScore,
    domainEvidence: meta.debug.domainEvidence ?? 0,
    guardrailReason: meta.debug.guardrailReason ?? null,
    lexicalCount: meta.debug.lexicalCount ?? 0,
    mergedCount: meta.debug.mergedCount ?? meta.sources.length,
    sourceCount,
    vectorCount: meta.debug.vectorCount ?? 0,
    expectedAnswerable: testCase.expected.answerable,
    expectedEvidenceQuote: testCase.expected.evidenceQuote ?? null,
    generated: testCase.generated,
    answerKeywordHit:
      testCase.expected.answerKeywords && testCase.expected.answerKeywords.length > 0
        ? answerKeywordHit
        : null,
    sourceKeywordHit:
      testCase.expected.sourceKeywords && testCase.expected.sourceKeywords.length > 0
        ? sourceKeywordHit
        : null,
    answerabilityCorrect: declined === !testCase.expected.answerable,
    sources: allowedSources.map((source) => ({
      docId: source.docId,
      title: source.title,
      chunkIndex: source.chunkIndex,
      score: source.score,
      origin: source.origin,
      vectorRank: source.vectorRank,
      vectorScore: source.vectorScore,
      lexicalRank: source.lexicalRank,
      lexicalScore: source.lexicalScore,
      rrfScore: source.rrfScore,
      finalScore: source.finalScore,
      section: source.section,
      startOffset: source.startOffset,
      endOffset: source.endOffset,
      textPreview: createPreview(source.text),
    })),
  };
}

function buildSummary(results: EvalCaseResult[]) {
  const total = results.length;
  const answered = results.filter((item) => !item.declined).length;
  const declined = total - answered;
  const avgBestScore =
    results.reduce((sum, item) => sum + item.bestScore, 0) / total;
  const avgVectorCount =
    results.reduce((sum, item) => sum + item.vectorCount, 0) / total;
  const avgLexicalCount =
    results.reduce((sum, item) => sum + item.lexicalCount, 0) / total;
  const avgMergedCount =
    results.reduce((sum, item) => sum + item.mergedCount, 0) / total;
  const avgDomainEvidence =
    results.reduce((sum, item) => sum + item.domainEvidence, 0) / total;
  const policyDeclined = results.filter((item) => item.policyDeclined).length;
  const modelDeclined = results.filter((item) => item.modelDeclined).length;
  const modelDeclinedAfterPolicyAnswer = results.filter(
    (item) => !item.policyDeclined && item.modelDeclined,
  ).length;
  const answerabilityCorrect = results.filter(
    (item) => item.answerabilityCorrect,
  ).length;
  const confusion = buildConfusion(results);

  const answerKeywordCases = results.filter(
    (item) => item.answerKeywordHit !== null,
  );
  const sourceKeywordCases = results.filter(
    (item) => item.sourceKeywordHit !== null,
  );

  const recommendedThreshold = findBestThreshold(results);
  const categorySummary = buildCategorySummary(results);

  return {
    total,
    answered,
    declined,
    answerableRate: answered / total,
    declineRate: declined / total,
    avgBestScore,
    avgVectorCount,
    avgLexicalCount,
    avgMergedCount,
    avgDomainEvidence,
    policyDeclined,
    modelDeclined,
    modelDeclinedAfterPolicyAnswer,
    answerabilityAccuracy: answerabilityCorrect / total,
    confusion,
    categorySummary,
    recommendedThreshold,
    recommendedDualThreshold: findBestDualThreshold(results),
    answerKeywordHitRate:
      answerKeywordCases.length > 0
        ? answerKeywordCases.filter((item) => item.answerKeywordHit).length /
          answerKeywordCases.length
        : null,
    sourceKeywordHitRate:
      sourceKeywordCases.length > 0
        ? sourceKeywordCases.filter((item) => item.sourceKeywordHit).length /
          sourceKeywordCases.length
        : null,
  };
}

function buildCategorySummary(results: EvalCaseResult[]) {
  const byCategory = new Map<EvalCategory, EvalCaseResult[]>();

  for (const result of results) {
    byCategory.set(result.category, [
      ...(byCategory.get(result.category) ?? []),
      result,
    ]);
  }

  return [...byCategory.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, items]) => {
      const correct = items.filter((item) => item.answerabilityCorrect).length;
      const declined = items.filter((item) => item.declined).length;
      const avgBestScore =
        items.reduce((sum, item) => sum + item.bestScore, 0) / items.length;

      return {
        category,
        total: items.length,
        correct,
        accuracy: correct / items.length,
        declined,
        declineRate: declined / items.length,
        avgBestScore,
        confusion: buildConfusion(items),
      };
    });
}

function findBestThreshold(results: EvalCaseResult[]) {
  let best = {
    threshold: 0.5,
    accuracy: 0,
    answered: 0,
    declined: 0,
  };

  for (let threshold = 0.5; threshold <= 0.95; threshold += 0.01) {
    const evaluated = evaluateThreshold(results, Number(threshold.toFixed(2)));

    if (evaluated.accuracy > best.accuracy) {
      best = evaluated;
    }
  }

  return best;
}

function findBestDualThreshold(results: EvalCaseResult[]) {
  let best = {
    declineThreshold: 0.55,
    answerThreshold: 0.75,
    accuracy: 0,
    answered: 0,
    declined: 0,
    confusion: { tp: 0, tn: 0, fp: 0, fn: 0 },
  };

  for (let decline = 0.45; decline <= 0.8; decline += 0.01) {
    for (let answer = decline + 0.02; answer <= 0.95; answer += 0.01) {
      const evaluated = evaluateDualThreshold(
        results,
        Number(decline.toFixed(2)),
        Number(answer.toFixed(2)),
      );

      if (evaluated.accuracy > best.accuracy) {
        best = evaluated;
      }
    }
  }

  return best;
}

function evaluateThreshold(results: EvalCaseResult[], threshold: number) {
  let correct = 0;
  let answered = 0;

  for (const item of results) {
    const declined = item.bestScore < threshold;
    const answerableCorrect = declined === !item.expectedAnswerable;

    if (!declined) {
      answered += 1;
    }

    if (answerableCorrect) {
      correct += 1;
    }
  }

  return {
    threshold,
    accuracy: correct / results.length,
    answered,
    declined: results.length - answered,
  };
}

function evaluateDualThreshold(
  results: EvalCaseResult[],
  declineThreshold: number,
  answerThreshold: number,
) {
  let answered = 0;
  let correct = 0;
  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;

  for (const item of results) {
    const declined =
      item.bestScore < declineThreshold
        ? true
        : item.bestScore >= answerThreshold
          ? false
          : true;
    const expectedDeclined = !item.expectedAnswerable;
    const answerableCorrect = declined === expectedDeclined;

    if (!declined) {
      answered += 1;
    }

    if (answerableCorrect) {
      correct += 1;
    }

    if (!declined && item.expectedAnswerable) {
      tp += 1;
    } else if (declined && expectedDeclined) {
      tn += 1;
    } else if (!declined && expectedDeclined) {
      fp += 1;
    } else if (declined && item.expectedAnswerable) {
      fn += 1;
    }
  }

  return {
    declineThreshold,
    answerThreshold,
    accuracy: correct / results.length,
    answered,
    declined: results.length - answered,
    confusion: { tp, tn, fp, fn },
  };
}

function buildConfusion(results: EvalCaseResult[]) {
  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;

  for (const item of results) {
    if (!item.declined && item.expectedAnswerable) {
      tp += 1;
    } else if (item.declined && !item.expectedAnswerable) {
      tn += 1;
    } else if (!item.declined && !item.expectedAnswerable) {
      fp += 1;
    } else if (item.declined && item.expectedAnswerable) {
      fn += 1;
    }
  }

  return { tp, tn, fp, fn };
}

async function loadDataset(datasetPath: string): Promise<EvalCase[]> {
  const raw = await readFile(datasetPath, "utf-8");
  const parsed = JSON.parse(raw) as EvalCase[];

  if (!Array.isArray(parsed)) {
    throw new Error("questions.json должен содержать массив кейсов");
  }

  return parsed;
}

function hasKeywordHit(text: string, keywords: string[]) {
  if (keywords.length === 0) {
    return false;
  }

  const normalizedText = normalizeAnswer(text);

  return keywords.some((keyword) =>
    normalizedText.includes(normalizeAnswer(keyword)),
  );
}

function normalizeAnswer(value: string) {
  return value.trim().toLocaleLowerCase();
}

function createPreview(value: string, maxLength = 420) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function isDeclineAnswer(value: string) {
  const normalized = normalizeAnswer(value).replace(/[.!?]+$/g, "");

  return DECLINE_ANSWER_VARIANTS.some(
    (variant) => normalizeAnswer(variant).replace(/[.!?]+$/g, "") === normalized,
  );
}

function inferCategory(testCase: EvalCase): EvalCategory {
  if (!testCase.expected.answerable) {
    return "unanswerable";
  }

  const question = normalizeAnswer(testCase.question);

  if (
    question.includes("о чем книга") ||
    question.includes("кратко опиши") ||
    question.includes("загруженные материалы")
  ) {
    return "broad";
  }

  if (
    question.includes("расшифруй") ||
    question.includes("какой компонент") ||
    question.includes("какая модель") ||
    question.includes("что написано")
  ) {
    return "exact";
  }

  return "answerable";
}

if (process.argv[1]?.endsWith("run-rag-eval.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
