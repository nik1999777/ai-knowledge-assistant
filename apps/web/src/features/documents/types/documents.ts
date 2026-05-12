export type DocumentListItem = {
  docId: string;
  title: string;
};

export type DocumentsResponse = {
  documents: DocumentListItem[];
};

export type DocumentDetailResponse = {
  docId: string;
  title: string;
  sourceType: "txt" | "md" | "pdf" | "docx" | "csv" | "zip";
  originalFileName: string;
  textContent: string;
  rawTextContent: string;
  characters: number;
  chunksCount: number;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
  chunks: Array<{
    chunkIndex: number;
    text: string;
    section?: string | null;
    chunkLen?: number;
    startOffset?: number;
    endOffset?: number;
  }>;
};

export type IngestedDocumentSummary = {
  docId: string;
  title: string;
  chunks: number;
  characters: number;
  sourceType?: "txt" | "md" | "pdf" | "docx" | "csv" | "zip";
  warnings?: string[];
};

export type IngestResponse = IngestedDocumentSummary & {
  documents?: IngestedDocumentSummary[];
  totalDocuments?: number;
};

export type DeleteDocumentResponse = {
  success: true;
  docId: string;
};
