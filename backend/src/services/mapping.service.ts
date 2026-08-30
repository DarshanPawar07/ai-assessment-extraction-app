import {
  mapAnswersToQuestions,
} from "../ai/answer-mapper";

import {
  aggregateLogicalAnswers,
} from "./extraction.service";

import {
  Assessment,
} from "../types/assessment";

import {
  AnswerMapping,
} from "../types/mapping";

import {
  memoryStore,
} from "../storage/memory.store";

/**
 * ============================================================
 * MAP ASSESSMENT ANSWERS
 * ============================================================
 *
 * IMPORTANT:
 *
 * The assessment may contain either:
 *
 *   1. raw page-level answers
 *   2. already aggregated logical answers
 *
 * Therefore this service performs ONE local aggregation
 * step before calling the AI mapper.
 *
 * This aggregation does NOT call Groq.
 *
 * Architecture:
 *
 * stored answers
 *      ↓
 * local aggregation
 *      ↓
 * logical answers
 *      ↓
 * AI answer mapper
 *      ↓
 * mappings
 */
export async function mapAssessmentAnswers(
  assessmentId: string
): Promise<Assessment> {
  /**
   * ----------------------------------------------------------
   * Load assessment
   * ----------------------------------------------------------
   */

  const assessment =
    memoryStore.getById(
      assessmentId
    );

  if (!assessment) {
    throw new Error(
      "Assessment not found."
    );
  }

  /**
   * ----------------------------------------------------------
   * Validate questions
   * ----------------------------------------------------------
   */

  if (
    assessment.questions.length ===
    0
  ) {
    throw new Error(
      "Questions must be extracted before answer mapping."
    );
  }

  /**
   * ----------------------------------------------------------
   * Validate answers
   * ----------------------------------------------------------
   */

  if (
    assessment.answers.length ===
    0
  ) {
    throw new Error(
      "Answers must be extracted before answer mapping."
    );
  }

  /**
   * ----------------------------------------------------------
   * Set mapping state
   * ----------------------------------------------------------
   */

  const preparing =
    memoryStore.update(
      assessmentId,
      {
        status:
          "mapping_answers",

        progress: {
          currentStep:
            "mapping_answers",

          progress:
            70,

          message:
            "Preparing answers for mapping.",
        },

        error:
          undefined,

        updatedAt:
          new Date().toISOString(),
      }
    );

  if (!preparing) {
    throw new Error(
      "Failed to update assessment before answer mapping."
    );
  }

  try {
    /**
     * ========================================================
     * LOCAL LOGICAL ANSWER AGGREGATION
     * ========================================================
     *
     * VERY IMPORTANT:
     *
     * Do NOT send raw page blocks directly to the AI mapper.
     *
     * Example raw answers:
     *
     *   ans-page-2-0
     *   ans-page-3-0
     *   ans-page-4-0
     *   ans-page-5-0
     *   ans-page-6-0
     *   ans-page-7-0
     *
     * become:
     *
     *   logical-1-a → pages 2,3,4
     *   logical-1-b → page 5
     *   logical-1-c → pages 6,7
     *
     * This operation is completely local.
     * It consumes ZERO Groq tokens.
     */
    const logicalAnswers =
      aggregateLogicalAnswers(
        assessment.answers,
        assessment.questions
      );

    /**
     * ----------------------------------------------------------
     * Diagnostic logging
     * ----------------------------------------------------------
     */

    console.log(
      "\n========== MAPPING INPUT =========="
    );

    console.log(
      JSON.stringify(
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
          })
        ),
        null,
        2
      )
    );

    console.log(
      "===================================\n"
    );

    /**
     * ========================================================
     * CALL AI MAPPER
     * ========================================================
     *
     * This is the ONLY AI operation in this service.
     */
    const result =
      await mapAnswersToQuestions({
        questions:
          assessment.questions,

        answers:
          logicalAnswers,
      });

    /**
     * ========================================================
     * NORMALIZE MAPPING TYPES
     * ========================================================
     *
     * The AI answer-mapper does not necessarily provide
     * the persistent database-style "id" field.
     *
     * Our application AnswerMapping type requires it.
     */
    const mappings:
      AnswerMapping[] =
      result.mappings.map(
        (
          mapping,
          index
        ) => ({
          id:
            `mapping-${index + 1}`,

          questionId:
            mapping.questionId,

          questionNumber:
            mapping.questionNumber,

          answerId:
            mapping.answerId,

          status:
            mapping.status,

          matchType:
            mapping.matchType,

          confidence:
            mapping.confidence,

          reason:
            mapping.reason,

          candidateQuestionIds:
            mapping.candidateQuestionIds ??
            [],
        })
      );

    /**
     * ========================================================
     * SUMMARY
     * ========================================================
     */

    const matchedCount =
      mappings.filter(
        (
          mapping
        ) =>
          mapping.status ===
          "matched"
      ).length;

    const unansweredCount =
      mappings.filter(
        (
          mapping
        ) =>
          mapping.status ===
          "unanswered"
      ).length;

    const ambiguousCount =
      mappings.filter(
        (
          mapping
        ) =>
          mapping.status ===
          "ambiguous"
      ).length;

    const unmatchedCount =
      mappings.filter(
        (
          mapping
        ) =>
          mapping.status ===
            "unmatched" &&
          mapping.answerId !==
            null
      ).length;

    /**
     * ========================================================
     * SAVE RESULT
     * ========================================================
     */

    const updatedAssessment =
      memoryStore.update(
        assessmentId,
        {
          /**
           * IMPORTANT:
           *
           * Save the logical answers, not the raw page blocks.
           */
          answers:
            logicalAnswers,

          mappings,

          status:
            "processing",

          progress: {
            currentStep:
              "mapping_answers",

            progress:
              75,

            message:
              `Mapping completed: ${matchedCount} matched, ${unansweredCount} unanswered, ${ambiguousCount} ambiguous, ${unmatchedCount} unmatched.`,
          },

          error:
            undefined,

          updatedAt:
            new Date().toISOString(),
        }
      );

    if (!updatedAssessment) {
      throw new Error(
        "Failed to update assessment after answer mapping."
      );
    }

    return updatedAssessment;
  } catch (
    error
  ) {
    const message =
      error instanceof Error
        ? error.message
        : "Answer mapping failed.";

    /**
     * Preserve failure state.
     */
    memoryStore.update(
      assessmentId,
      {
        status:
          "failed",

        progress: {
          currentStep:
            "failed",

          progress:
            75,

          message:
            "Answer mapping failed.",
        },

        error:
          message,

        updatedAt:
          new Date().toISOString(),
      }
    );

    throw error;
  }
}

/**
 * ============================================================
 * GET MAPPING SUMMARY
 * ============================================================
 */

export interface MappingSummary {
  totalQuestions: number;

  matchedQuestions: number;

  unansweredQuestions: number;

  ambiguousMappings: number;

  unmatchedAnswers: number;
}

export function getMappingSummary(
  assessment: Assessment
): MappingSummary {
  const mappings =
    assessment.mappings ?? [];

  const matchedQuestions =
    mappings.filter(
      (
        mapping
      ) =>
        mapping.status ===
          "matched" &&
        mapping.questionId !==
          null
    );

  const unansweredQuestions =
    mappings.filter(
      (
        mapping
      ) =>
        mapping.status ===
          "unanswered" &&
        mapping.questionId !==
          null
    );

  const ambiguousMappings =
    mappings.filter(
      (
        mapping
      ) =>
        mapping.status ===
        "ambiguous"
    );

  const unmatchedAnswers =
    mappings.filter(
      (
        mapping
      ) =>
        mapping.status ===
          "unmatched" &&
        mapping.answerId !==
          null
    );

  return {
    totalQuestions:
      assessment.questions.length,

    matchedQuestions:
      matchedQuestions.length,

    unansweredQuestions:
      unansweredQuestions.length,

    ambiguousMappings:
      ambiguousMappings.length,

    unmatchedAnswers:
      unmatchedAnswers.length,
  };
}