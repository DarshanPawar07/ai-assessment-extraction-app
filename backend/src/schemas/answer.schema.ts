import { z } from "zod";

import { boundingBoxSchema } from "./document.schema";

/**
 * ============================================================
 * ANSWER REGION
 * ============================================================
 */

export const answerRegionSchema =
  z.object({
    page: z
      .number()
      .int()
      .positive(),

    bbox:
      boundingBoxSchema,
  });

/**
 * ============================================================
 * ANSWER
 * ============================================================
 *
 * The AI can return null for optional string fields.
 * We allow null at the schema boundary and normalize it
 * inside answer-extractor.ts.
 */

export const answerSchema =
  z.object({
    id:
      z.string().min(1),

    text:
      z.string(),

    explicitQuestionNumber:
      z
        .string()
        .nullable()
        .optional(),

    studentQuestionNumber:
      z
        .string()
        .nullable()
        .optional(),

    continuationOf:
      z
        .string()
        .nullable()
        .optional(),

    regions:
      z
        .array(
          answerRegionSchema
        )
        .min(1),

    order:
      z
        .number()
        .int()
        .nonnegative(),

    extractionConfidence:
      z
        .number()
        .min(0)
        .max(1)
        .optional(),
  });

/**
 * ============================================================
 * TOP-LEVEL EXTRACTION RESPONSE
 * ============================================================
 */

export const answerExtractionResultSchema =
  z.object({
    answers:
      z.array(
        answerSchema
      ),
  });

/**
 * ============================================================
 * TYPES
 * ============================================================
 */

export type AnswerRegionInput =
  z.infer<
    typeof answerRegionSchema
  >;

export type AnswerInput =
  z.infer<
    typeof answerSchema
  >;

export type AnswerExtractionResult =
  z.infer<
    typeof answerExtractionResultSchema
  >;