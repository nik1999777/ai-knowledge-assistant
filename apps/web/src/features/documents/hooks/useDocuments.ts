import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../app/queryKeys";
import { getDocuments } from "../api/documents";

export function useDocuments(query?: string) {
  return useQuery({
    queryKey: queryKeys.documents(query ?? ""),
    queryFn: () => getDocuments(query),
    placeholderData: (previousData) => previousData,
    refetchInterval: (query) => {
      const docs = query.state.data?.documents ?? [];
      return docs.some((d) => d.ingestionStatus === "processing") ? 2000 : false;
    },
  });
}
