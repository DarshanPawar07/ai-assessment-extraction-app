// TODO: Implement backend/src/schemas/question.schema.ts
import { z } from "zod";
import { boundingBoxSchema } from "./document.schema";

export const questionSchema = z.object({
  id: z.string().min(1),
  number: z.string().min(1),
  text: z.string(),
  page: z.number().int().positive(),
  bbox: boundingBoxSchema,
  parentNumber: z.string().optional(),
  isSubPart: z.boolean(),
  order: z.number().int().nonnegative(),
  maxMarks: z.number().nonnegative().optional(),
});

export const questionExtractionResultSchema = z.object({
  questions: z.array(questionSchema),
});

export type QuestionInput = z.infer<typeof questionSchema>;
export type QuestionExtractionResult = z.infer<
  typeof questionExtractionResultSchema
>;