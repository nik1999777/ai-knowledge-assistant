import { z } from "zod";

export const documentsQuerySchema = z.object({
  q: z.string().trim().optional(),
});

export type DocumentsQueryInput = z.infer<typeof documentsQuerySchema>;

export const documentParamsSchema = z.object({
  docId: z.string().min(1, "docId обязателен"),
});

export type DocumentParamsInput = z.infer<typeof documentParamsSchema>;
