import path from "node:path";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import JSZip from "jszip";
import { createAppError } from "../utils/app-error.js";

export type ParsedDocument = {
  title: string;
  text: string;
  sourceType: "txt" | "md" | "pdf" | "docx" | "csv" | "zip";
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

  if (extension === ".csv") {
    return formatCsvText(text);
  }

  return text;
}

async function extractZipText(buffer: Buffer, warnings: string[]) {
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

  const limitedTextFiles = textFiles.slice(0, MAX_ARCHIVE_TEXT_FILES);

  if (textFiles.length > MAX_ARCHIVE_TEXT_FILES) {
    warnings.push(
      `В архиве найдено ${textFiles.length} текстовых файлов, проиндексированы первые ${MAX_ARCHIVE_TEXT_FILES}`,
    );
  }

  const skippedFiles = files.length - textFiles.length;

  if (skippedFiles > 0) {
    warnings.push(
      `В архиве пропущено файлов без поддерживаемого текстового формата: ${skippedFiles}`,
    );
  }

  const sections: string[] = [];

  for (const file of limitedTextFiles) {
    const extension = path.extname(file.name).toLowerCase();
    const content = await file.async("nodebuffer");
    const text = (await extractText(extension, content)).trim();

    if (!text) {
      continue;
    }

    sections.push(`## ${normalizeArchivePath(file.name)}\n\n${text}`);
  }

  if (sections.length === 0) {
    throw createAppError(400, "ZIP-архив не содержит читаемого текста");
  }

  return sections.join("\n\n---\n\n");
}

function isSystemArchivePath(filePath: string) {
  return (
    filePath.startsWith("__MACOSX/") ||
    filePath.includes("/.") ||
    path.basename(filePath).startsWith(".")
  );
}

function normalizeArchivePath(filePath: string) {
  return filePath.replace(/\\/g, "/").replace(/^\/+/, "");
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
