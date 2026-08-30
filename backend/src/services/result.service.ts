import {
  Assessment,
} from "../types/assessment";

import {
  EvaluationResult,
  AssessmentEvaluationSummary,
} from "../types/evaluation";

import {
  memoryStore,
} from "../storage/memory.store";

/**
 * ============================================================
 * FRONTEND RESULT TYPES
 * ============================================================
 */

export interface QuestionResult {
  questionId: string;

  questionNumber: string;

  questionText: string;

  maxMarks: number;

  answerId: string | null;

  answerText: string | null;

  mappingStatus: string | null;

  mappingConfidence: number | null;

  score: number;

  percentage: number;

  evaluation: string;

  strengths: string[];

  weaknesses: string[];

  evaluationConfidence: number | null;
}

export interface AssessmentResult {
  assessmentId: string;

  status: string;

  progress: {
    currentStep: string;

    progress: number;

    message: string;
  };

  summary: AssessmentEvaluationSummary;

  questions: QuestionResult[];

  createdAt: string;

  updatedAt: string;
}

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

function getMaxMarks(
  value: number | undefined,
  questionNumber: string
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      `Invalid maximum marks for question ${questionNumber}.`
    );
  }

  return value;
}

function roundToTwo(
  value: number
): number {
  return Number(
    value.toFixed(2)
  );
}

/**
 * ============================================================
 * BUILD SUMMARY LOCALLY
 * ============================================================
 *
 * This is used when the assessment hasn't been fully
 * evaluated yet.
 *
 * No AI call.
 */
function buildFallbackSummary(
  assessment: Assessment,
  evaluations: EvaluationResult[]
): AssessmentEvaluationSummary {
  const totalMarks =
    assessment.questions.reduce(
      (
        total,
        question
      ) =>
        total +
        getMaxMarks(
          question.maxMarks,
          question.number
        ),
      0
    );

  const obtainedMarks =
    evaluations.reduce(
      (
        total,
        evaluation
      ) =>
        total +
        evaluation.score,
      0
    );

  const evaluatedQuestions =
    evaluations.filter(
      (
        evaluation
      ) =>
        Boolean(
          evaluation.answerId
        )
    ).length;

  const unansweredQuestions =
    assessment.questions.length -
    evaluatedQuestions;

  const percentage =
    totalMarks > 0
      ? (
          obtainedMarks /
          totalMarks
        ) *
        100
      : 0;

  return {
    totalQuestions:
      assessment.questions.length,

    evaluatedQuestions,

    unansweredQuestions:
      Math.max(
        0,
        unansweredQuestions
      ),

    totalMarks:
      roundToTwo(
        totalMarks
      ),

    obtainedMarks:
      roundToTwo(
        obtainedMarks
      ),

    percentage:
      roundToTwo(
        percentage
      ),
  };
}

/**
 * ============================================================
 * GET ASSESSMENT RESULT
 * ============================================================
 *
 * ZERO GROQ CALLS.
 */
export function getAssessmentResult(
  assessmentId: string
): AssessmentResult {
  const assessment =
    memoryStore.getById(
      assessmentId
    );

  if (!assessment) {
    throw new Error(
      "Assessment not found."
    );
  }

  const evaluations =
    assessment.evaluations ??
    [];

  /**
   * Index evaluations by question.
   */
  const evaluationsByQuestionId =
    new Map(
      evaluations.map(
        (
          evaluation
        ) => [
          evaluation.questionId,
          evaluation,
        ]
      )
    );

  /**
   * Index mappings by question.
   */
  const mappingsByQuestionId =
    new Map(
      assessment.mappings.map(
        (
          mapping
        ) => [
          mapping.questionId,
          mapping,
        ]
      )
    );

  /**
   * Index answers by ID.
   */
  const answersById =
    new Map(
      assessment.answers.map(
        (
          answer
        ) => [
          answer.id,
          answer,
        ]
      )
    );

  /**
   * Keep questions in canonical order.
   */
  const orderedQuestions =
    [
      ...assessment.questions,
    ].sort(
      (
        a,
        b
      ) =>
        a.order -
        b.order
    );

  const questions:
    QuestionResult[] =
    orderedQuestions.map(
      (
        question
      ) => {
        const mapping =
          mappingsByQuestionId.get(
            question.id
          );

        const evaluation =
          evaluationsByQuestionId.get(
            question.id
          );

        const answer =
          mapping?.answerId
            ? answersById.get(
                mapping.answerId
              )
            : undefined;

        const maxMarks =
          getMaxMarks(
            question.maxMarks,
            question.number
          );

        return {
          questionId:
            question.id,

          questionNumber:
            question.number,

          questionText:
            question.text,

          maxMarks,

          answerId:
            answer?.id ??
            mapping?.answerId ??
            null,

          answerText:
            answer?.text ??
            null,

          mappingStatus:
            mapping?.status ??
            null,

          mappingConfidence:
            typeof mapping?.confidence ===
            "number"
              ? mapping.confidence
              : null,

          score:
            evaluation?.score ??
            0,

          percentage:
            evaluation?.percentage ??
            0,

          evaluation:
            evaluation?.evaluation ??
            (
              mapping?.status ===
              "unanswered"
                ? "No answer was provided for this question."
                : "This question has not been evaluated yet."
            ),

          strengths:
            evaluation?.strengths ??
            [],

          weaknesses:
            evaluation?.weaknesses ??
            (
              mapping?.status ===
              "unanswered"
                ? [
                    "No answer provided.",
                  ]
                : []
            ),

          evaluationConfidence:
            typeof evaluation?.confidence ===
            "number"
              ? evaluation.confidence
              : null,
        };
      }
    );

  const summary =
    assessment.evaluationSummary ??
    buildFallbackSummary(
      assessment,
      evaluations
    );

  return {
    assessmentId,

    status:
      assessment.status,

    progress: {
      currentStep:
        assessment.progress.currentStep,

      progress:
        assessment.progress.progress,

      message:
        assessment.progress.message,
    },

    summary,

    questions,

    createdAt:
      assessment.createdAt,

    updatedAt:
      assessment.updatedAt,
  };
}