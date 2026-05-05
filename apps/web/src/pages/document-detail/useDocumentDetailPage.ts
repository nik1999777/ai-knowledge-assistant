import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { useDocumentDetail } from "../../features/documents/hooks/useDocumentDetail";

export function useDocumentDetailPage() {
  const params = useParams<{ docId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const docId = params.docId;
  const { data, isLoading, error } = useDocumentDetail(docId);
  const chunkParam = searchParams.get("chunk");
  const activeChunkIndex =
    chunkParam !== null && !Number.isNaN(Number(chunkParam))
      ? Number(chunkParam)
      : null;
  const activeSnippet =
    typeof location.state === "object" &&
    location.state !== null &&
    "snippet" in location.state &&
    typeof location.state.snippet === "string"
      ? location.state.snippet
      : null;

  return {
    activeChunkIndex,
    activeSnippet,
    data,
    isLoading,
    error,
    docId,
    formatDate,
  };
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
