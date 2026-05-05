import path from "node:path";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { createAppError } from "../utils/app-error.js";

export type ParsedDocument = {
  title: string;
  text: string;
  sourceType: "txt" | "md" | "pdf" | "docx";
  warnings: string[];
};

type ParseDocumentInput = {
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
};

type SupportedSourceType = ParsedDocument["sourceType"];

const SUPPORTED_EXTENSIONS = new Set([".txt", ".md", ".pdf", ".docx"]);

export async function parseDocument({
  fileName,
  mimeType,
  buffer,
}: ParseDocumentInput): Promise<ParsedDocument> {
  const extension = path.extname(fileName).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw createAppError(
      400,
      "Поддерживаются только файлы .txt, .md, .pdf и .docx",
    );
  }

  if (buffer.byteLength === 0) {
    throw createAppError(400, "Файл пустой");
  }

  const extractedText = await extractText(extension, buffer);
  const text = extractedText.trim();

  if (!text) {
    throw createAppError(400, "Не удалось извлечь читаемый текст из файла");
  }

  if (!/[A-Za-zА-Яа-я0-9]/u.test(text)) {
    throw createAppError(400, "Файл не содержит читаемого текста");
  }

  const warnings: string[] = [];

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

  if (extension === ".pdf") {
    return mimeType === "application/pdf";
  }

  if (extension === ".docx") {
    return (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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

  return buffer.toString("utf-8");
}
