// TODO: Implement backend/src/schemas/mapping.schema.ts
import { z } from "zod";

export const mappingStatusSchema = z.enum([
  "matched",
  "unanswered",
  "unmatched",
  "low_confidence",
]);

export const mappingSignalsSchema = z.object({
  explicitNumberMatch: z.number().min(0).max(1).optional(),
  semanticMatch: z.number().min(0).max(1).optional(),
  orderMatch: z.number().min(0).max(1).optional(),
  contextMatch: z.number().min(0).max(1).optional(),
});

export const answerMappingSchema = z.object({
  id: z.string().min(1),
  questionId: z.string().min(1),
  answerId: z.string().min(1).optional(),
  status: mappingStatusSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().optional(),
  signals: mappingSignalsSchema.optional(),
});

export const mappingResultSchema = z.object({
  mappings: z.array(answerMappingSchema),
});

export type AnswerMappingInput = z.infer<typeof answerMappingSchema>;
export type MappingResult = z.infer<typeof mappingResultSchema>;