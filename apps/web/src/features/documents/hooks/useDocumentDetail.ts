import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../app/queryKeys";
import { getDocumentDetail } from "../api/documents";

export function useDocumentDetail(docId?: string) {
  return useQuery({
    queryKey: queryKeys.documentDetail(docId ?? ""),
    queryFn: () => getDocumentDetail(docId as string),
    enabled: Boolean(docId),
  });
}
