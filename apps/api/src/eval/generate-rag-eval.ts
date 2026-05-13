import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runMigrations } from "../db/migrator.js";
import { initPostgres } from "../db/postgres.client.js";
import { listDocumentsForEval } from "../repositories/documents.repository.js";
import { chunkDocument, type TextChunk } from "../services/chunk.service.js";

type GeneratedEvalCase = {
  id: string;
  category: "answerable" | "unanswerable";
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
const MIN_CHUNK_LENGTH = 160;
const KEYWORDS_PER_CASE = 4;
const GENERATED_DATASET_NAME = "questions.generated.json";
const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`]+`/g;
const MARKED_TEXT_PATTERN = /\*\*([^*]+)\*\*|^#{1,6}\s+(.+)$/gm;
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
  const cases: GeneratedEvalCase[] = [];

  for (const document of documents.slice(0, MAX_DOCS)) {
    if (cases.length >= (options.maxAnswerableCases ?? MAX_ANSWERABLE_CASES)) {
      break;
    }

    const chunks = chunkDocument(document.textContent)
      .filter(isUsefulChunk)
      .sort((left, right) => right.chunkLen - left.chunkLen);

    for (const chunk of chunks.slice(0, 2)) {
      if (cases.length >= (options.maxAnswerableCases ?? MAX_ANSWERABLE_CASES)) {
        break;
      }

      const chunkKeywords = selectKeywords(chunk.text, KEYWORDS_PER_CASE);

      if (chunkKeywords.length < 2) {
        continue;
      }

      const evidenceQuote = createEvidenceQuote(chunk.text, chunkKeywords);
      const evidenceKeywords = selectKeywords(evidenceQuote, KEYWORDS_PER_CASE);
      const keywords =
        evidenceKeywords.length >= 2 ? evidenceKeywords : chunkKeywords;
      const id = `generated-${String(cases.length + 1).padStart(3, "0")}`;

      cases.push({
        id,
        category: "answerable",
        question: buildQuestion(document.title, chunk, keywords, evidenceQuote),
        expected: {
          answerable: true,
          answerKeywords: keywords.slice(0, 3),
          sourceKeywords: keywords,
          evidenceQuote,
        },
        generated: {
          docId: document.docId,
          title: document.title,
          chunkIndex: chunk.chunkIndex,
          section: chunk.section,
          startOffset: chunk.startOffset,
          endOffset: chunk.endOffset,
        },
      });
    }
  }

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

function isUsefulChunk(chunk: TextChunk) {
  const prose = toEvalProse(chunk.text);

  return (
    prose.length >= MIN_CHUNK_LENGTH &&
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

function selectKeywords(text: string, limit: number) {
  const counts = new Map<string, number>();
  const textWithoutCode = toEvalProse(text);

  for (const token of extractMarkedTerms(textWithoutCode)) {
    counts.set(token, (counts.get(token) ?? 0) + 4);
  }

  for (const token of tokenizeKeywordCandidates(textWithoutCode)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([token]) => token);
}

function extractMarkedTerms(text: string) {
  const terms: string[] = [];

  for (const match of text.matchAll(MARKED_TEXT_PATTERN)) {
    const value = match[1] ?? match[2];

    if (!value) {
      continue;
    }

    terms.push(...tokenizeKeywordCandidates(value));
  }

  return terms;
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

  return token.length >= 6 && token.length <= 32;
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

function isCodeLikeLine(line: string) {
  if (/^```/.test(line)) {
    return true;
  }

  if (
    /^(import|from|const|let|var|function|class|return|if|else|for|while|try|catch|break|continue)\b/.test(
      line,
    )
  ) {
    return true;
  }

  const codeSignals = [
    /[{};]/,
    /\b\w+\s*\(/,
    /(?:^|\s)[\w.]+\s*(?:=|\+=|-=|\*=|\/=|==|===|<=|>=|=>)/,
  ];

  return codeSignals.filter((pattern) => pattern.test(line)).length >= 2;
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
