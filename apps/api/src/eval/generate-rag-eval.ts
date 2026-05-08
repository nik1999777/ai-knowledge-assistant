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

const STOPWORDS = new Set([
  "about",
  "also",
  "and",
  "are",
  "because",
  "before",
  "between",
  "для",
  "как",
  "или",
  "это",
  "что",
  "этот",
  "эта",
  "the",
  "this",
  "that",
  "with",
  "from",
  "into",
  "при",
  "про",
  "над",
  "под",
  "без",
  "или",
  "его",
  "она",
  "они",
  "мы",
  "вы",
]);

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
  return (
    chunk.chunkLen >= MIN_CHUNK_LENGTH &&
    /[A-Za-zА-Яа-я0-9]/u.test(chunk.text) &&
    selectKeywords(chunk.text, 2).length >= 2
  );
}

function buildQuestion(
  title: string,
  chunk: TextChunk,
  keywords: string[],
  evidenceQuote: string,
) {
  const subject = chunk.section ? `разделе "${chunk.section}"` : `документе "${title}"`;
  const label = extractLeadingLabel(evidenceQuote);

  if (label) {
    return `Что указано в пункте "${label}" в ${subject}?`;
  }

  const keywordHint = keywords.slice(0, 2).join(" и ");

  return `Что говорится о ${keywordHint} в ${subject}?`;
}

function extractLeadingLabel(value: string) {
  const normalized = value
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
  const match = normalized.match(/^([\p{L}\p{N}_ .,/()\-]{3,80}):/u);
  const label = match?.[1]?.trim();

  return label && label.length <= 80 ? label : null;
}

function selectKeywords(text: string, limit: number) {
  const tokens = text
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .filter((token) => !STOPWORDS.has(token));
  const counts = new Map<string, number>();

  for (const token of tokens) {
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

function createEvidenceQuote(text: string, keywords: string[]) {
  const sentences = text
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
      .sort((left, right) => right.hits - left.hits)[0]?.sentence ?? text;

  return createPreview(bestSentence, 260);
}

function buildUnanswerableCases(existingCount: number): GeneratedEvalCase[] {
  return [
    {
      id: `generated-${String(existingCount + 1).padStart(3, "0")}`,
      category: "unanswerable",
      question: "Какой курс доллара сегодня?",
      expected: { answerable: false },
    },
    {
      id: `generated-${String(existingCount + 2).padStart(3, "0")}`,
      category: "unanswerable",
      question: "Кто занимает пост президента США прямо сейчас?",
      expected: { answerable: false },
    },
    {
      id: `generated-${String(existingCount + 3).padStart(3, "0")}`,
      category: "unanswerable",
      question: "Какая погода будет завтра в Москве?",
      expected: { answerable: false },
    },
  ];
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
