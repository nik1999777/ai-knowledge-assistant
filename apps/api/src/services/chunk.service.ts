export type TextChunk = {
  text: string;
  chunkIndex: number;
  chunkLen: number;
  section: string | null;
};

type ChunkOptions = {
  overlap?: number;
  size?: number;
};

const DEFAULT_SIZE = 700;
const DEFAULT_OVERLAP = 140;

export function chunkText(text: string, size = 500, overlap = 100) {
  return chunkDocument(text, { size, overlap }).map((chunk) => chunk.text);
}

export function chunkDocument(
  rawText: string,
  options: ChunkOptions = {},
): TextChunk[] {
  const size = options.size ?? DEFAULT_SIZE;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;
  const text = normalizeText(rawText);
  const blocks = splitIntoBlocks(text);
  const chunks: TextChunk[] = [];

  let activeSection: string | null = null;
  let buffer = "";

  for (const block of blocks) {
    const heading = extractHeading(block);

    if (heading) {
      activeSection = heading;
      continue;
    }

    const candidate = buffer ? `${buffer}\n\n${block}` : block;

    if (candidate.length <= size) {
      buffer = candidate;
      continue;
    }

    if (buffer.trim()) {
      pushChunk(chunks, buffer, activeSection);
      buffer = "";
    }

    if (block.length <= size) {
      buffer = block;
      continue;
    }

    for (const piece of splitLongText(block, size, overlap)) {
      pushChunk(chunks, piece, activeSection);
    }
  }

  if (buffer.trim()) {
    pushChunk(chunks, buffer, activeSection);
  }

  return chunks.map((chunk, index) => ({
    ...chunk,
    chunkIndex: index,
  }));
}

function pushChunk(
  chunks: Array<Omit<TextChunk, "chunkIndex">>,
  text: string,
  section: string | null,
) {
  const normalized = text.trim();

  if (!normalized) {
    return;
  }

  chunks.push({
    text: normalized,
    chunkLen: normalized.length,
    section,
  });
}

function splitLongText(text: string, size: number, overlap: number) {
  const pieces: string[] = [];
  const sentences = splitIntoSentences(text);
  let buffer = "";

  for (const sentence of sentences) {
    const candidate = buffer ? `${buffer} ${sentence}` : sentence;

    if (candidate.length <= size) {
      buffer = candidate;
      continue;
    }

    if (buffer.trim()) {
      pieces.push(buffer.trim());
    }

    if (sentence.length <= size) {
      buffer = sentence;
      continue;
    }

    for (const windowed of windowSlice(sentence, size, overlap)) {
      pieces.push(windowed);
    }

    buffer = "";
  }

  if (buffer.trim()) {
    pieces.push(buffer.trim());
  }

  return pieces;
}

function windowSlice(text: string, size: number, overlap: number) {
  const parts: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    const part = text.slice(start, end).trim();

    if (part) {
      parts.push(part);
    }

    if (end >= text.length) {
      break;
    }

    start = Math.max(end - overlap, start + 1);
  }

  return parts;
}

function splitIntoBlocks(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function splitIntoSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function extractHeading(block: string) {
  const markdownMatch = block.match(/^#{1,6}\s+(.+)$/);

  if (markdownMatch?.[1]) {
    return markdownMatch[1].trim();
  }

  if (
    block.length <= 120 &&
    /^[\p{L}\p{N}\s\-:()"'`.,]+$/u.test(block) &&
    block === block.toUpperCase()
  ) {
    return block.trim();
  }

  return null;
}

function normalizeText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00A0]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
