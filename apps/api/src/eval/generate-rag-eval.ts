import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runMigrations } from "../db/migrator.js";
import { initPostgres } from "../db/postgres.client.js";
import {
  listDocumentsForEval,
  type EvalDocument,
} from "../repositories/documents.repository.js";
import { chunkDocument, type TextChunk } from "../services/chunk.service.js";

type GeneratedEvalCategory =
  | "answerable"
  | "definition"
  | "mentioned-not-defined"
  | "multi-chunk"
  | "partial"
  | "tutor-broad"
  | "unanswerable";

type GeneratedEvalCase = {
  id: string;
  category: GeneratedEvalCategory;
  question: string;
  expected: {
    answerable: boolean;
    answerKeywords?: string[];
    evidenceQuote?: string;
    sourceKeywords?: string[];
  };
  generated?: {
    docId: string;
    title: string;
    chunkIndex: number;
    section?: string | null;
    startOffset?: number;
    endOffset?: number;
  };
};

const MAX_DOCS = 8;
const MAX_ANSWERABLE_CASES = 12;
const MAX_CHUNKS_PER_DOC = 3;
const MIN_CHUNK_LENGTH = 160;
const KEYWORDS_PER_CASE = 4;
const GENERATED_DATASET_NAME = "questions.generated.json";
const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`]+`/g;
const DEFINITION_SIGNAL_SOURCES = [
  String.raw`\s[-–—]\s`,
  String.raw`\s+(?:это|является|означает)\b`,
  String.raw`\s+(?:is|are|means|refers to)\b`,
];
const DEFINITION_SIGNAL_PATTERNS = DEFINITION_SIGNAL_SOURCES.map(
  (source) => new RegExp(source, "iu"),
);
const OUT_OF_SCOPE_GUARDRAIL_QUESTIONS = [
  "Какой личный пароль указан в документах?",
  "Какой точный адрес проживания пользователя?",
  "Какой приватный номер телефона автора этих документов?",
];

export async function generateRagEvalDataset(options: {
  datasetPath: string;
  maxAnswerableCases?: number;
}) {
  const documents = await listDocumentsForEval("user");
  const candidateCases: Array<Omit<GeneratedEvalCase, "id">> = [];
  const maxAnswerableCases = options.maxAnswerableCases ?? MAX_ANSWERABLE_CASES;

  for (const document of documents.slice(0, MAX_DOCS)) {
    if (candidateCases.length >= maxAnswerableCases * 2) {
      break;
    }

    const chunks = chunkDocument(document.textContent)
      .filter(isUsefulChunk)
      .sort((left, right) => right.chunkLen - left.chunkLen);

    for (const chunk of chunks.slice(0, MAX_CHUNKS_PER_DOC)) {
      const chunkKeywords = selectKeywords(chunk.text, KEYWORDS_PER_CASE);

      if (chunkKeywords.length < 2) {
        continue;
      }

      const evidenceQuote = createEvidenceQuote(chunk.text, chunkKeywords);
      const evidenceKeywords = selectKeywords(evidenceQuote, KEYWORDS_PER_CASE);
      const keywords =
        evidenceKeywords.length >= 2 ? evidenceKeywords : chunkKeywords;

      candidateCases.push(
        ...buildChunkCaseCandidates(document, chunk, keywords, evidenceQuote),
      );
    }

    candidateCases.push(...buildMultiChunkCaseCandidates(document, chunks));
  }

  const cases = selectBalancedCases(candidateCases, maxAnswerableCases).map(
    (testCase, index) => ({
      id: `generated-${String(index + 1).padStart(3, "0")}`,
      ...testCase,
    }),
  );

  if (cases.length === 0) {
    throw new Error(
      "Не удалось сгенерировать eval dataset: загрузите user-документы с достаточно длинным текстом",
    );
  }

  cases.push(...buildUnanswerableCases(cases.length));

  await mkdir(path.dirname(options.datasetPath), { recursive: true });
  await writeFile(options.datasetPath, JSON.stringify(cases, null, 2), "utf-8");

  return cases;
}

async function main() {
  const projectRoot = path.resolve(process.cwd(), "../..");
  const datasetPath = path.join(
    projectRoot,
    "test-data/rag-eval",
    GENERATED_DATASET_NAME,
  );

  await initPostgres();
  await runMigrations();

  const cases = await generateRagEvalDataset({ datasetPath });

  console.log(
    `[generated-eval] wrote ${cases.length} cases to ${datasetPath}`,
  );
}

const MIN_PROSE_RATIO = 0.4;

function isUsefulChunk(chunk: TextChunk) {
  const prose = toEvalProse(chunk.text);
  const proseRatio = chunk.text.length > 0 ? prose.length / chunk.text.length : 0;

  return (
    prose.length >= MIN_CHUNK_LENGTH &&
    proseRatio >= MIN_PROSE_RATIO &&
    /[A-Za-zА-Яа-я0-9]/u.test(prose) &&
    selectKeywords(prose, 2).length >= 2
  );
}

function buildQuestion(
  title: string,
  chunk: TextChunk,
  keywords: string[],
  _evidenceQuote: string,
) {
  const subject = chunk.section
    ? `документе "${title}", в разделе "${chunk.section}"`
    : `документе "${title}"`;
  const keywordHint = keywords.slice(0, 2).join(" и ");

  return `Какая информация есть про ${keywordHint} в ${subject}?`;
}

function buildChunkCaseCandidates(
  document: EvalDocument,
  chunk: TextChunk,
  keywords: string[],
  evidenceQuote: string,
): Array<Omit<GeneratedEvalCase, "id">> {
  const cases: Array<Omit<GeneratedEvalCase, "id">> = [
    {
      category: "answerable",
      question: buildQuestion(document.title, chunk, keywords, evidenceQuote),
      expected: {
        answerable: true,
        answerKeywords: keywords.slice(0, 3),
        sourceKeywords: keywords,
        evidenceQuote,
      },
      generated: buildGeneratedMetadata(document, chunk),
    },
    {
      category: "partial",
      question: `Что документ "${document.title}" говорит про ${keywords[0]}, и какие ограничения или исключения для этого указаны?`,
      expected: {
        answerable: true,
        answerKeywords: [keywords[0]],
        sourceKeywords: keywords.slice(0, 2),
        evidenceQuote,
      },
      generated: buildGeneratedMetadata(document, chunk),
    },
    {
      category: "tutor-broad",
      question: `Объясни простыми словами, что в документе "${document.title}" сказано про ${keywords[0]}.`,
      expected: {
        answerable: true,
        answerKeywords: [keywords[0]],
        sourceKeywords: keywords.slice(0, 2),
        evidenceQuote,
      },
      generated: buildGeneratedMetadata(document, chunk),
    },
  ];

  const definitionTerm = findDefinitionTerm(chunk.text, keywords);

  if (definitionTerm) {
    cases.push({
      category: "definition",
      question: `Что такое ${definitionTerm} в документе "${document.title}"?`,
      expected: {
        answerable: true,
        answerKeywords: [definitionTerm, ...keywords.slice(0, 2)],
        sourceKeywords: [definitionTerm],
        evidenceQuote,
      },
      generated: buildGeneratedMetadata(document, chunk),
    });
  }

  const mentionedTerm = keywords.find(
    (keyword) => !hasDefinitionSignal(chunk.text, keyword),
  );

  if (mentionedTerm) {
    cases.push({
      category: "mentioned-not-defined",
      question: `Что такое ${mentionedTerm} в документе "${document.title}"?`,
      expected: {
        answerable: true,
        answerKeywords: ["не определяется", "явно", mentionedTerm],
        sourceKeywords: [mentionedTerm],
        evidenceQuote,
      },
      generated: buildGeneratedMetadata(document, chunk),
    });
  }

  return cases;
}

function buildMultiChunkCaseCandidates(
  document: EvalDocument,
  chunks: TextChunk[],
): Array<Omit<GeneratedEvalCase, "id">> {
  if (chunks.length < 2) {
    return [];
  }

  const left = chunks[0];
  const right = chunks.find((chunk) => chunk.chunkIndex !== left.chunkIndex);

  if (!right) {
    return [];
  }

  const leftKeywords = selectKeywords(left.text, 4).filter(isStrongLinkTerm);
  const rightKeywords = selectKeywords(right.text, 4).filter(isStrongLinkTerm);
  const leftTerm = leftKeywords[0];
  const rightTerm = rightKeywords.find((keyword) => keyword !== leftTerm);

  if (!leftTerm || !rightTerm) {
    return [];
  }

  const evidenceQuote = createPreview(
    `${createEvidenceQuote(left.text, leftKeywords)} ${createEvidenceQuote(
      right.text,
      rightKeywords,
    )}`,
    260,
  );

  return [
    {
      category: "multi-chunk",
      question: `Как в документе "${document.title}" связаны ${leftTerm} и ${rightTerm}?`,
      expected: {
        answerable: true,
        answerKeywords: [leftTerm, rightTerm],
        sourceKeywords: [leftTerm, rightTerm],
        evidenceQuote,
      },
      generated: buildGeneratedMetadata(document, left),
    },
  ];
}

function isStrongLinkTerm(token: string) {
  if (/^[a-z_][a-z0-9_-]*$/u.test(token)) {
    return true;
  }

  return !/(ого|его|ему|ому|ыми|ими|ая|ое|ый|ий)$/u.test(token);
}

function buildGeneratedMetadata(document: EvalDocument, chunk: TextChunk) {
  return {
    docId: document.docId,
    title: document.title,
    chunkIndex: chunk.chunkIndex,
    section: chunk.section,
    startOffset: chunk.startOffset,
    endOffset: chunk.endOffset,
  };
}

function selectBalancedCases(
  candidates: Array<Omit<GeneratedEvalCase, "id">>,
  limit: number,
) {
  const categories: GeneratedEvalCategory[] = [
    "definition",
    "mentioned-not-defined",
    "partial",
    "multi-chunk",
    "tutor-broad",
    "answerable",
  ];
  const selected: Array<Omit<GeneratedEvalCase, "id">> = [];
  const usedQuestions = new Set<string>();

  while (selected.length < limit) {
    const before = selected.length;

    for (const category of categories) {
      const next = candidates.find(
        (testCase) =>
          testCase.category === category && !usedQuestions.has(testCase.question),
      );

      if (!next) {
        continue;
      }

      selected.push(next);
      usedQuestions.add(next.question);

      if (selected.length >= limit) {
        break;
      }
    }

    if (selected.length === before) {
      break;
    }
  }

  return selected;
}

function selectKeywords(text: string, limit: number) {
  const counts = new Map<string, number>();
  const prose = toEvalProse(text);
  const proseLower = prose.toLocaleLowerCase();

  for (const token of extractInlineCodeTerms(text)) {
    // Only boost Latin/mixed inline-code terms that also appear in prose.
    // Pure Cyrillic tokens from inline code are usually verb forms in comments, not domain terms.
    if (!/^[а-яё]+$/u.test(token) && proseLower.includes(token)) {
      addKeywordScore(counts, token, 4);
    }
  }

  const proseTokens = tokenizeKeywordCandidates(prose);
  const proseTokenFrequency = countTokens(proseTokens);

  for (const [token, frequency] of proseTokenFrequency.entries()) {
    addKeywordScore(counts, token, scoreKeywordCandidate(token, frequency));
  }

  return [...counts.entries()]
    .filter(([, score]) => score > 0)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([token]) => token);
}

function addKeywordScore(
  counts: Map<string, number>,
  token: string,
  score: number,
) {
  if (score <= 0 || !isKeywordCandidate(token)) {
    return;
  }

  counts.set(token, (counts.get(token) ?? 0) + score);
}

function extractInlineCodeTerms(text: string) {
  const terms: string[] = [];

  for (const match of text.matchAll(INLINE_CODE_PATTERN)) {
    terms.push(...tokenizeKeywordCandidates(match[0].replace(/`/g, " ")));
  }

  return terms;
}

function countTokens(tokens: string[]) {
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return counts;
}

function findDefinitionTerm(text: string, keywords: string[]) {
  return keywords.find((keyword) => hasDefinitionSignal(text, keyword));
}

function hasDefinitionSignal(text: string, keyword: string) {
  const normalizedKeyword = keyword.toLocaleLowerCase();
  const sentences = toEvalProse(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.some((sentence) => {
    const normalizedSentence = sentence.toLocaleLowerCase();
    const keywordIndex = normalizedSentence.indexOf(normalizedKeyword);

    if (keywordIndex === -1) {
      return false;
    }

    const afterKeyword = normalizedSentence.slice(
      keywordIndex + normalizedKeyword.length,
      keywordIndex + normalizedKeyword.length + 80,
    );

    return DEFINITION_SIGNAL_PATTERNS.some((pattern) =>
      pattern.test(afterKeyword),
    );
  });
}

function tokenizeKeywordCandidates(text: string) {
  return text
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter(isKeywordCandidate);
}

function isKeywordCandidate(token: string) {
  if (!/[\p{L}]/u.test(token) || /^\d+$/.test(token)) {
    return false;
  }

  if (/^[a-z_][a-z0-9_]*$/u.test(token) && token.length < 6) {
    return false;
  }

  if (/^[а-яё]+$/u.test(token)) {
    if (token.length < 7) {
      return false;
    }
  }

  return token.length >= 4 && token.length <= 32;
}

function scoreKeywordCandidate(token: string, _frequency: number) {
  if (/^[a-z][a-z0-9_-]*$/u.test(token)) {
    return /[0-9_-]/u.test(token) ? 3 : 2;
  }

  if (!/^[а-яё]+$/u.test(token)) {
    return 2;
  }

  return 0;
}

function createEvidenceQuote(text: string, keywords: string[]) {
  const prose = toEvalProse(text);
  const sentences = prose
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const normalizedKeywords = keywords.map((keyword) => keyword.toLocaleLowerCase());
  const bestSentence =
    sentences
      .map((sentence) => ({
        sentence,
        hits: normalizedKeywords.filter((keyword) =>
          sentence.toLocaleLowerCase().includes(keyword),
        ).length,
      }))
      .sort((left, right) => right.hits - left.hits)[0]?.sentence ?? prose;

  return createPreview(bestSentence, 260);
}

function toEvalProse(text: string) {
  return text
    .replace(CODE_BLOCK_PATTERN, " ")
    .replace(INLINE_CODE_PATTERN, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !isCodeLikeLine(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const CODE_SYMBOL_PATTERN = /[{}()[\]=<>:;]/g;
const CODE_SYMBOL_RATIO_THRESHOLD = 0.15;

function isCodeLikeLine(line: string): boolean {
  const trimmed = line.trim();

  if (!trimmed || /^```/.test(trimmed)) {
    return true;
  }

  // Language-agnostic: code has high density of structural symbols
  const symbolCount = (trimmed.match(CODE_SYMBOL_PATTERN) ?? []).length;

  if (symbolCount / trimmed.length > CODE_SYMBOL_RATIO_THRESHOLD) {
    return true;
  }

  // Catches function/method/class definitions without keyword lists:
  // Python: def foo(x):   Ruby: def foo(x)   JS: foo(x) {
  if (/^\w[\w.]*\s*\(.*\)\s*[:;{]?\s*$/.test(trimmed)) {
    return true;
  }

  // Module import pattern: universal across Python, JS, Go, Rust, Java, etc.
  // These lines have no structural symbols but are definitively code.
  if (/^(import|from)\s+\S/.test(trimmed)) {
    return true;
  }

  return false;
}

function buildUnanswerableCases(existingCount: number): GeneratedEvalCase[] {
  return OUT_OF_SCOPE_GUARDRAIL_QUESTIONS.map((question, index) => ({
    id: `generated-${String(existingCount + index + 1).padStart(3, "0")}`,
    category: "unanswerable",
    question,
    expected: { answerable: false },
  }));
}

function createPreview(value: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

if (process.argv[1]?.endsWith("generate-rag-eval.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
