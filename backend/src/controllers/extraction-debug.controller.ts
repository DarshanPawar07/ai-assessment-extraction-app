import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  aggregateLogicalAnswers,
} from "../services/extraction.service";

import {
  memoryStore,
} from "../storage/memory.store";

/**
 * GET /api/extraction/debug/answers/:assessmentId
 *
 * ZERO AI / ZERO GROQ COST.
 *
 * Reads the existing assessment from MemoryStore and
 * locally aggregates its stored answers against the
 * canonical questions.
 */
export async function debugAnswerAggregation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const assessmentId =
      Array.isArray(
        req.params.assessmentId
      )
        ? req.params.assessmentId[0]
        : req.params.assessmentId;

    if (!assessmentId) {
      res.status(400).json({
        success: false,
        message:
          "Assessment ID is required.",
      });

      return;
    }

    /**
     * Read assessment from the CURRENT Node process.
     */
    const assessment =
      memoryStore.getById(
        assessmentId
      );

    if (!assessment) {
      res.status(404).json({
        success: false,
        message:
          "Assessment not found.",
      });

      return;
    }

    /**
     * These are the answers currently stored.
     *
     * They may be raw page-level answers such as:
     *
     * ans-page-2-0
     * ans-page-3-0
     * ...
     */
    const rawAnswers =
      assessment.answers ?? [];

    /**
     * IMPORTANT:
     *
     * Pass BOTH:
     *
     *   rawAnswers
     *   assessment.questions
     *
     * The questions are required to resolve cases such as:
     *
     * "3) Explain effective modular design..."
     *
     * → canonical 1(c)
     */
    const logicalAnswers =
      aggregateLogicalAnswers(
        rawAnswers,
        assessment.questions
      );

    res.status(200).json({
      success: true,

      assessmentId,

      rawAnswerCount:
        rawAnswers.length,

      logicalAnswerCount:
        logicalAnswers.length,

      rawAnswers:
        rawAnswers.map(
          (
            answer
          ) => ({
            id:
              answer.id,

            studentQuestionNumber:
              answer.studentQuestionNumber ??
              null,

            explicitQuestionNumber:
              answer.explicitQuestionNumber ??
              null,

            continuationOf:
              answer.continuationOf ??
              null,

            pages:
              answer.regions.map(
                (
                  region
                ) =>
                  region.page
              ),

            textPreview:
              answer.text
                .slice(
                  0,
                  160
                )
                .replace(
                  /\n/g,
                  " "
                ),
          })
        ),

      logicalAnswers:
        logicalAnswers.map(
          (
            answer
          ) => ({
            id:
              answer.id,

            studentQuestionNumber:
              answer.studentQuestionNumber ??
              null,

            explicitQuestionNumber:
              answer.explicitQuestionNumber ??
              null,

            continuationOf:
              answer.continuationOf ??
              null,

            pages:
              answer.regions.map(
                (
                  region
                ) =>
                  region.page
              ),

            regionCount:
              answer.regions.length,

            text:
              answer.text,
          })
        ),
    });
  } catch (
    error
  ) {
    next(error);
  }
}