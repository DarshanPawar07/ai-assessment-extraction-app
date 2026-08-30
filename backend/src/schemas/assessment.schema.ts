import { z } from "zod";

import { answerSchema } from "./answer.schema";
import { documentFileSchema } from "./document.schema";
import { questionSchema } from "./question.schema";
import { answerMappingSchema } from "./mapping.schema";
import { gradingSummarySchema } from "./grading.schema";

export const assessmentStatusSchema = z.enum([
  "created",
  "processing",
  "extracting_questions",
  "extracting_answers",
  "mapping_answers",
  "grading",
  "completed",
  "failed",
]);

export const processingProgressSchema = z.object({
  currentStep: assessmentStatusSchema,
  progress: z.number().min(0).max(100),
  message: z.string(),
});

export const assessmentSchema = z.object({
  id: z.string().min(1),

  status: assessmentStatusSchema,

  progress: processingProgressSchema,

  questionPaper: documentFileSchema,

  answerSheet: documentFileSchema,

  questions: z.array(questionSchema),

  answers: z.array(answerSchema),

  mappings: z.array(answerMappingSchema),

  grading: gradingSummarySchema.optional(),

  createdAt: z.string(),

  updatedAt: z.string(),

  error: z.string().optional(),
});

export type AssessmentInput = z.infer<typeof assessmentSchema>;
export type ProcessingProgressInput = z.infer<
  typeof processingProgressSchema
>;