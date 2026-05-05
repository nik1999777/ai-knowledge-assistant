import { useState } from "react";
import { useDeleteDocument } from "../../features/documents/hooks/useDeleteDocument";
import { useDocuments } from "../../features/documents/hooks/useDocuments";
import { useUploadDocument } from "../../features/documents/hooks/useUploadDocument";
import { useDebounce } from "../../shared/hooks/useDebounce";

export function useDocumentsPage() {
  const [appError, setAppError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [documentsSearch, setDocumentsSearch] = useState("");
  const debouncedDocumentsSearch = useDebounce(documentsSearch, 350);

  const {
    data: documentsData,
    isLoading: documentsLoading,
    isFetching: documentsFetching,
  } = useDocuments(debouncedDocumentsSearch);

  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();
  const documents = documentsData?.documents ?? [];

  async function handleUpload() {
    if (!selectedFile) {
      setUploadMessage("Выбери файл .txt, .md, .pdf или .docx");
      return;
    }

    setUploadMessage("");

    try {
      const json = await uploadMutation.mutateAsync(selectedFile);
      const warnings =
        json.warnings && json.warnings.length > 0
          ? ` Предупреждения: ${json.warnings.join(" ")}`
          : "";

      setUploadMessage(
        `Файл "${json.title}" успешно загружен. Chunks: ${json.chunks}. Символов: ${json.characters}.${warnings}`,
      );
      setSelectedFile(null);
      setAppError("");
    } catch (err) {
      setUploadMessage(
        err instanceof Error ? err.message : "Неизвестная ошибка",
      );
    }
  }

  async function handleDeleteDocument(docId: string) {
    try {
      await deleteMutation.mutateAsync(docId);
      setAppError("");
    } catch (err) {
      setAppError(
        err instanceof Error ? err.message : "Ошибка удаления документа",
      );
    }
  }

  return {
    pageError: appError,
    selectedFile,
    uploadMessage,
    documentsSearch,
    documents,
    documentsLoading,
    documentsSearching: documentsFetching && !documentsLoading,
    uploadLoading: uploadMutation.isPending,
    setSelectedFile,
    setDocumentsSearch,
    handleUpload,
    handleDeleteDocument,
  };
}
