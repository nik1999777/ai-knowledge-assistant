import { z } from "zod";

export const chatSchema = z.object({
  question: z.string().min(1, "question обязателен"),
  sessionId: z.string().uuid().optional(),
  answerMode: z.enum(["strict", "balanced", "tutor"]).default("balanced"),
});

export const chatSessionParamsSchema = z.object({
  sessionId: z.string().uuid("sessionId должен быть UUID"),
});

export const chatSessionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(20).default(5),
});

export type ChatInput = z.infer<typeof chatSchema>;
export type ChatSessionParams = z.infer<typeof chatSessionParamsSchema>;
export type ChatSessionQuery = z.infer<typeof chatSessionQuerySchema>;
