import path from "node:path";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import JSZip from "jszip";
import { createAppError } from "../utils/app-error.js";

export type ParsedDocument = {
  title: string;
  text: string;
  sourceType: "txt" | "md" | "pdf" | "docx" | "csv" | "zip";
  originalFileName?: string;
  warnings: string[];
};

type ParseDocumentInput = {
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
};

type SupportedSourceType = ParsedDocument["sourceType"];

const SUPPORTED_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".pdf",
  ".docx",
  ".csv",
  ".zip",
]);
const ARCHIVE_TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv"]);
const MAX_ARCHIVE_TEXT_FILES = 100;

export async function parseUploadedDocuments(
  input: ParseDocumentInput,
): Promise<ParsedDocument[]> {
  const extension = path.extname(input.fileName).toLowerCase();

  if (extension !== ".zip") {
    return [await parseDocument(input)];
  }

  if (input.buffer.byteLength === 0) {
    throw createAppError(400, "Файл пустой");
  }

  const warnings: string[] = [];
  const documents = await extractZipDocuments(input.buffer, warnings);

  if (input.mimeType && !isSupportedMimeType(extension, input.mimeType)) {
    warnings.push(
      "Расширение файла поддерживается, но MIME type не совпадает с ожидаемым",
    );
  }

  return documents.map((document) => ({
    ...document,
    warnings: [...warnings, ...document.warnings],
  }));
}

export async function parseDocument({
  fileName,
  mimeType,
  buffer,
}: ParseDocumentInput): Promise<ParsedDocument> {
  const extension = path.extname(fileName).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw createAppError(
      400,
      "Поддерживаются только файлы .txt, .md, .pdf, .docx, .csv и .zip",
    );
  }

  if (buffer.byteLength === 0) {
    throw createAppError(400, "Файл пустой");
  }

  const archiveWarnings: string[] = [];
  const extractedText =
    extension === ".zip"
      ? await extractZipText(buffer, archiveWarnings)
      : await extractText(extension, buffer);
  const text = extractedText.trim();

  if (!text) {
    throw createAppError(400, "Не удалось извлечь читаемый текст из файла");
  }

  if (!/[A-Za-zА-Яа-я0-9]/u.test(text)) {
    throw createAppError(400, "Файл не содержит читаемого текста");
  }

  const warnings: string[] = [...archiveWarnings];

  if (text.length < 100) {
    warnings.push("Из файла извлечено мало текста, качество поиска может быть ниже");
  }

  if (mimeType && !isSupportedMimeType(extension, mimeType)) {
    warnings.push(
      "Расширение файла поддерживается, но MIME type не совпадает с ожидаемым",
    );
  }

  return {
    title: path.basename(fileName, extension).trim() || "uploaded-document",
    text,
    sourceType: extension.slice(1) as SupportedSourceType,
    warnings,
  };
}

function isSupportedMimeType(extension: string, mimeType: string) {
  if (extension === ".txt") {
    return mimeType === "text/plain";
  }

  if (extension === ".md") {
    return mimeType === "text/markdown" || mimeType === "text/plain";
  }

  if (extension === ".csv") {
    return (
      mimeType === "text/csv" ||
      mimeType === "text/plain" ||
      mimeType === "application/csv"
    );
  }

  if (extension === ".pdf") {
    return mimeType === "application/pdf";
  }

  if (extension === ".docx") {
    return (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  }

  if (extension === ".zip") {
    return (
      mimeType === "application/zip" ||
      mimeType === "application/x-zip-compressed" ||
      mimeType === "application/octet-stream"
    );
  }

  return false;
}

async function extractText(extension: string, buffer: Buffer) {
  if (extension === ".pdf") {
    try {
      const result = await pdf(buffer);
      return result.text;
    } catch {
      throw createAppError(400, "Не удалось распарсить PDF-файл");
    }
  }

  if (extension === ".docx") {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch {
      throw createAppError(400, "Не удалось распарсить DOCX-файл");
    }
  }

  const text = buffer.toString("utf-8");

  if (extension === ".md") {
    return normalizeMarkdownText(text);
  }

  if (extension === ".csv") {
    return formatCsvText(text);
  }

  return text;
}

async function extractZipText(buffer: Buffer, warnings: string[]) {
  const documents = await extractZipDocuments(buffer, warnings);

  return documents
    .map(
      (document) =>
        `## ${document.originalFileName ?? document.title}\n\n${document.text}`,
    )
    .join("\n\n---\n\n");
}

async function extractZipDocuments(buffer: Buffer, warnings: string[]) {
  const { files, textFiles } = await getArchiveTextFiles(buffer);
  const limitedTextFiles = textFiles.slice(0, MAX_ARCHIVE_TEXT_FILES);

  pushArchiveWarnings(files.length, textFiles.length, warnings);
  const documents: ParsedDocument[] = [];
  let skippedNavigationDocuments = 0;

  for (const file of limitedTextFiles) {
    const extension = path.extname(file.name).toLowerCase();
    const content = await file.async("nodebuffer");
    const text = (await extractText(extension, content)).trim();

    if (!text) {
      continue;
    }

    if (extension === ".md" && isArchiveNavigationMarkdown(content.toString("utf-8"), text)) {
      skippedNavigationDocuments += 1;
      continue;
    }

    documents.push({
      title: deriveDocumentTitle(text, file.name),
      text,
      sourceType: extension.slice(1) as ParsedDocument["sourceType"],
      originalFileName: normalizeArchivePath(file.name),
      warnings: [],
    });
  }

  if (skippedNavigationDocuments > 0) {
    warnings.push(
      `В архиве пропущено навигационных Markdown-страниц без собственного содержательного текста: ${skippedNavigationDocuments}`,
    );
  }

  if (documents.length === 0) {
    throw createAppError(400, "ZIP-архив не содержит читаемого текста");
  }

  return documents;
}

async function getArchiveTextFiles(buffer: Buffer) {
  let archive: JSZip;

  try {
    archive = await JSZip.loadAsync(buffer);
  } catch {
    throw createAppError(400, "Не удалось распарсить ZIP-архив");
  }

  const files = Object.values(archive.files)
    .filter((file) => !file.dir && !isSystemArchivePath(file.name))
    .sort((left, right) => left.name.localeCompare(right.name));
  const textFiles = files.filter((file) =>
    ARCHIVE_TEXT_EXTENSIONS.has(path.extname(file.name).toLowerCase()),
  );

  if (textFiles.length === 0) {
    throw createAppError(
      400,
      "ZIP-архив не содержит поддерживаемых текстовых файлов .txt, .md или .csv",
    );
  }

  return { files, textFiles };
}

function pushArchiveWarnings(
  filesCount: number,
  textFilesCount: number,
  warnings: string[],
) {
  if (textFilesCount > MAX_ARCHIVE_TEXT_FILES) {
    warnings.push(
      `В архиве найдено ${textFilesCount} текстовых файлов, проиндексированы первые ${MAX_ARCHIVE_TEXT_FILES}`,
    );
  }

  const skippedFiles = filesCount - textFilesCount;

  if (skippedFiles > 0) {
    warnings.push(
      `В архиве пропущено файлов без поддерживаемого текстового формата: ${skippedFiles}`,
    );
  }
}

function isSystemArchivePath(filePath: string) {
  return (
    filePath.startsWith("__MACOSX/") ||
    filePath.includes("/.") ||
    path.basename(filePath).startsWith(".")
  );
}

function normalizeArchivePath(filePath: string) {
  return filePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .map(decodePathSegment)
    .join("/");
}

function deriveDocumentTitle(text: string, filePath: string) {
  const heading = text.match(/^#\s+(.+)$/m)?.[1]?.trim();

  if (heading) {
    return stripMarkdownInlineSyntax(heading);
  }

  const fileName = path.basename(normalizeArchivePath(filePath), path.extname(filePath));
  return stripNotionIdSuffix(fileName).trim() || "uploaded-document";
}

function stripMarkdownInlineSyntax(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function stripNotionIdSuffix(fileName: string) {
  return fileName.replace(/\s+[0-9a-f]{32}$/i, "");
}

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function normalizeMarkdownText(text: string) {
  return text
    .split("\n")
    .map(normalizeMarkdownLine)
    .filter((line) => line !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function normalizeMarkdownLine(line: string) {
  const links = parseMarkdownLinks(line);

  if (links.length === 1 && isStandaloneLocalMarkdownLink(line, links[0])) {
    return null;
  }

  return replaceMarkdownLinksWithLabels(line, links);
}

function isArchiveNavigationMarkdown(rawText: string, normalizedText: string) {
  const localNavigationLinks = rawText
    .split("\n")
    .filter((line) => {
      const links = parseMarkdownLinks(line);
      return links.length === 1 && isStandaloneLocalMarkdownLink(line, links[0]);
    }).length;

  if (localNavigationLinks < 2) {
    return false;
  }

  const substantiveLines = normalizedText
    .split("\n")
    .filter((line) => isSubstantiveMarkdownLine(line)).length;

  return substantiveLines <= 4;
}

function isSubstantiveMarkdownLine(line: string) {
  const trimmed = stripMarkdownInlineSyntax(line.trim());

  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    trimmed === "---" ||
    trimmed.startsWith(">") ||
    /^[-*]\s*$/.test(trimmed)
  ) {
    return false;
  }

  const withoutListMarker = trimmed.replace(/^[-*]\s+/, "").trim();

  if (!/[.!?。！？:：]/u.test(withoutListMarker) && withoutListMarker.length < 80) {
    return false;
  }

  return /[\p{L}\p{N}]/u.test(withoutListMarker);
}

type MarkdownLink = {
  start: number;
  end: number;
  label: string;
  target: string;
};

function parseMarkdownLinks(line: string) {
  const links: MarkdownLink[] = [];
  let index = 0;

  while (index < line.length) {
    const openBracket = line.indexOf("[", index);

    if (openBracket === -1) {
      break;
    }

    const closeBracket = line.indexOf("]", openBracket + 1);

    if (closeBracket === -1 || line[closeBracket + 1] !== "(") {
      index = openBracket + 1;
      continue;
    }

    const targetStart = closeBracket + 2;
    const targetEnd = findMarkdownLinkTargetEnd(line, targetStart);

    if (targetEnd === -1) {
      index = closeBracket + 1;
      continue;
    }

    links.push({
      start: openBracket,
      end: targetEnd + 1,
      label: line.slice(openBracket + 1, closeBracket),
      target: line.slice(targetStart, targetEnd),
    });
    index = targetEnd + 1;
  }

  return links;
}

function findMarkdownLinkTargetEnd(line: string, start: number) {
  let depth = 0;

  for (let index = start; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\\" && index + 1 < line.length) {
      index += 1;
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      if (depth === 0) {
        return index;
      }

      depth -= 1;
    }
  }

  return findPermissiveMarkdownLinkTargetEnd(line, start);
}

function findPermissiveMarkdownLinkTargetEnd(line: string, start: number) {
  const lastCloseParen = line.lastIndexOf(")");

  if (lastCloseParen < start) {
    return -1;
  }

  const target = line.slice(start, lastCloseParen).trim().toLowerCase();

  if (target.endsWith(".md") || target.includes(".md#")) {
    return lastCloseParen;
  }

  return -1;
}

function replaceMarkdownLinksWithLabels(line: string, links: MarkdownLink[]) {
  if (links.length === 0) {
    return line;
  }

  let result = "";
  let cursor = 0;

  for (const link of links) {
    const prefixEnd =
      link.start > 0 && line[link.start - 1] === "!" ? link.start - 1 : link.start;
    result += line.slice(cursor, prefixEnd);
    result += link.label;
    cursor = link.end;
  }

  result += line.slice(cursor);

  return result;
}

function isStandaloneLocalMarkdownLink(line: string, link: MarkdownLink) {
  const surroundingText = `${line.slice(0, link.start)}${line.slice(link.end)}`;

  if (!/^[-*]?\s*$/.test(surroundingText)) {
    return false;
  }

  const target = link.target.trim().toLowerCase();

  return (
    !target.startsWith("http://") &&
    !target.startsWith("https://") &&
    !target.startsWith("mailto:") &&
    !target.startsWith("#") &&
    (target.endsWith(".md") || target.includes(".md#"))
  );
}

function formatCsvText(text: string) {
  const rows = parseCsvRows(text);

  if (rows.length === 0) {
    return text;
  }

  return rows
    .map((row) => row.map((cell) => cell.trim()).filter(Boolean).join(" | "))
    .filter(Boolean)
    .join("\n");
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
