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
  sourceType: "txt" | "md" | "pdf" | "docx";
  originalFileName: string;
  textContent: string;
  characters: number;
  chunksCount: number;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
  chunks: Array<{
    chunkIndex: number;
    text: string;
  }>;
};

export type IngestResponse = {
  docId: string;
  title: string;
  chunks: number;
  characters: number;
  sourceType?: "text" | "txt" | "md" | "pdf" | "docx";
  warnings?: string[];
};

export type DeleteDocumentResponse = {
  success: true;
  docId: string;
};
