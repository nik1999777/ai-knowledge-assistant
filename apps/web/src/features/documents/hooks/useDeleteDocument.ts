import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../app/queryKeys";
import { deleteDocument } from "../api/documents";

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.documents() });
    },
  });
}
