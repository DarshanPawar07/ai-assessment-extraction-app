// TODO: Implement backend/src/schemas/grading.schema.ts
import { z } from "zod";

export const questionGradeSchema = z.object({
  questionId: z.string().min(1),
  marks: z.number().nonnegative(),
  maxMarks: z.number().positive(),
  feedback: z.string().optional(),
  status: z
    .enum(["correct", "partially_correct", "incorrect", "unanswered"])
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const gradingSummarySchema = z.object({
  totalMarks: z.number().nonnegative(),
  obtainedMarks: z.number().nonnegative(),
  percentage: z.number().min(0).max(100),
  grades: z.array(questionGradeSchema),
  overallFeedback: z.string().optional(),
});

export type QuestionGradeInput = z.infer<typeof questionGradeSchema>;
export type GradingSummaryInput = z.infer<typeof gradingSummarySchema>;