import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../app/queryKeys";
import { uploadDocument } from "../api/documents";

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.documents() });
    },
  });
}
