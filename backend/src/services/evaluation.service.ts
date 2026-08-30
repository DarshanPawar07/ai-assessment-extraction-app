import { Assessment } from "../types/assessment";

import {
  EvaluationResult,
  AssessmentEvaluationSummary,
} from "../types/evaluation";

import {
  evaluateAnswer,
  createEvaluationResult,
} from "../ai/groq/evaluator";

import { memoryStore } from "../storage/memory.store";

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

/**
 * Return a valid maximum-mark value.
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

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
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
 * UNANSWERED RESULT
 * ============================================================
 */

function createUnansweredEvaluation(
  assessmentId: string,
  questionId: string,
  questionNumber: string,
  maxMarks: number
): EvaluationResult {
  return {
    id:
      `evaluation-${questionId}`,

    assessmentId,

    questionId,

    questionNumber,

    answerId:
      "",

    maxMarks,

    score:
      0,

    percentage:
      0,

    evaluation:
      "No answer was provided for this question.",

    strengths:
      [],

    weaknesses:
      [
        "No answer provided.",
      ],

    confidence:
      1,

    createdAt:
      new Date().toISOString(),
  };
}

/**
 * ============================================================
 * BUILD SUMMARY
 * ============================================================
 */

function buildEvaluationSummary(
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

  const unansweredQuestions =
    evaluations.filter(
      (
        evaluation
      ) =>
        !evaluation.answerId
    ).length;

  const evaluatedQuestions =
    evaluations.filter(
      (
        evaluation
      ) =>
        Boolean(
          evaluation.answerId
        )
    ).length;

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

    unansweredQuestions,

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
        clamp(
          percentage,
          0,
          100
        )
      ),
  };
}

/**
 * ============================================================
 * GET EXISTING EVALUATION
 * ============================================================
 *
 * Used to make evaluation resumable.
 */
function getExistingEvaluation(
  assessment: Assessment,
  questionId: string
): EvaluationResult | undefined {
  return (
    assessment.evaluations ??
    []
  ).find(
    (
      evaluation
    ) =>
      evaluation.questionId ===
      questionId
  );
}

/**
 * ============================================================
 * SAVE ONE EVALUATION
 * ============================================================
 *
 * Immediately persists one question's evaluation.
 *
 * This is the checkpoint that makes evaluation resumable.
 */
function saveEvaluationCheckpoint(
  assessmentId: string,
  result: EvaluationResult
): Assessment {
  const latest =
    memoryStore.getById(
      assessmentId
    );

  if (!latest) {
    throw new Error(
      "Assessment not found while saving evaluation checkpoint."
    );
  }

  const existingEvaluations =
    (
      latest.evaluations ??
      []
    ).filter(
      (
        evaluation
      ) =>
        evaluation.questionId !==
        result.questionId
    );

  const evaluations =
    [
      ...existingEvaluations,
      result,
    ];

  const updated =
    memoryStore.update(
      assessmentId,
      {
        evaluations,
      }
    );

  if (!updated) {
    throw new Error(
      `Failed to save evaluation checkpoint for question ${result.questionNumber}.`
    );
  }

  return updated;
}

/**
 * ============================================================
 * MAIN EVALUATION SERVICE
 * ============================================================
 */

export async function evaluateAssessment(
  assessmentId: string
): Promise<Assessment> {
  let assessment =
    memoryStore.getById(
      assessmentId
    );

  if (!assessment) {
    throw new Error(
      "Assessment not found."
    );
  }

  /**
   * ==========================================================
   * QUESTIONS
   * ==========================================================
   */

  if (
    assessment.questions.length ===
    0
  ) {
    throw new Error(
      "Questions must be extracted before evaluation."
    );
  }

  /**
   * ==========================================================
   * MAPPINGS
   * ==========================================================
   */

  if (
    assessment.mappings.length ===
    0
  ) {
    throw new Error(
      "Answers must be mapped to questions before evaluation."
    );
  }

  /**
   * ==========================================================
   * INITIAL STATE
   * ==========================================================
   */

  const initial =
    memoryStore.update(
      assessmentId,
      {
        status:
          "evaluating",

        progress: {
          currentStep:
            "evaluating_answers",

          progress:
            80,

          message:
            "Preparing answer evaluation.",
        },

        error:
          undefined,

        updatedAt:
          new Date().toISOString(),
      }
    );

  if (!initial) {
    throw new Error(
      "Failed to update assessment before evaluation."
    );
  }

  assessment =
    initial;

  /**
   * ==========================================================
   * INDEX ANSWERS
   * ==========================================================
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
   * ==========================================================
   * CANONICAL QUESTION ORDER
   * ==========================================================
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

  /**
   * ==========================================================
   * PROCESS EACH QUESTION
   * ==========================================================
   */

  for (
    let index = 0;
    index <
    orderedQuestions.length;
    index += 1
  ) {
    const question =
      orderedQuestions[index];

    const maxMarks =
      getMaxMarks(
        question.maxMarks,
        question.number
      );

    /**
     * Reload the latest assessment state.
     *
     * This is important because previous evaluations are saved
     * after every question.
     */
    assessment =
      memoryStore.getById(
        assessmentId
      ) ?? assessment;

    /**
     * --------------------------------------------------------
     * CHECKPOINT: already evaluated
     * --------------------------------------------------------
     *
     * If this question already has a result, do NOT call Groq
     * again.
     */

    const existingEvaluation =
      getExistingEvaluation(
        assessment,
        question.id
      );

    if (
      existingEvaluation
    ) {
      console.log(
        `[Evaluation Service] Skipping ${question.number} - already evaluated (${existingEvaluation.score}/${maxMarks}).`
      );

      const progress =
        80 +
        Math.round(
          (
            (
              index + 1
            ) /
            orderedQuestions.length
          ) *
            15
        );

      const updated =
        memoryStore.update(
          assessmentId,
          {
            progress: {
              currentStep:
                "evaluating_answers",

              progress,

              message:
                `Evaluated ${index + 1}/${orderedQuestions.length} questions.`,
            },

            status:
              "evaluating",
          }
        );

      if (
        updated
      ) {
        assessment =
          updated;
      }

      continue;
    }

    /**
     * --------------------------------------------------------
     * FIND MATCHED ANSWER
     * --------------------------------------------------------
     */

    const mapping =
      assessment.mappings.find(
        (
          candidate
        ) =>
          candidate.questionId ===
            question.id &&
          candidate.status ===
            "matched" &&
          Boolean(
            candidate.answerId
          )
      );

    /**
     * --------------------------------------------------------
     * NO ANSWER
     *
     * ZERO GROQ CALLS.
     * --------------------------------------------------------
     */

    if (
      !mapping ||
      !mapping.answerId
    ) {
      const unanswered =
        createUnansweredEvaluation(
          assessmentId,

          question.id,

          question.number,

          maxMarks
        );

      assessment =
        saveEvaluationCheckpoint(
          assessmentId,
          unanswered
        );

      console.log(
        `[Evaluation Service] ${question.number}: no answer. Saved as 0/${maxMarks}.`
      );

      const progress =
        80 +
        Math.round(
          (
            (
              index + 1
            ) /
            orderedQuestions.length
          ) *
            15
        );

      const updated =
        memoryStore.update(
          assessmentId,
          {
            progress: {
              currentStep:
                "evaluating_answers",

              progress,

              message:
                `Evaluated ${index + 1}/${orderedQuestions.length} questions.`,
            },

            status:
              "evaluating",
          }
        );

      if (
        updated
      ) {
        assessment =
          updated;
      }

      continue;
    }

    /**
     * --------------------------------------------------------
     * RESOLVE ANSWER
     * --------------------------------------------------------
     */

    const answer =
      answersById.get(
        mapping.answerId
      );

    if (
      !answer
    ) {
      const missingAnswer =
        createUnansweredEvaluation(
          assessmentId,

          question.id,

          question.number,

          maxMarks
        );

      missingAnswer.weaknesses =
        [
          "Mapped answer could not be found in the assessment data.",
        ];

      assessment =
        saveEvaluationCheckpoint(
          assessmentId,
          missingAnswer
        );

      console.warn(
        `[Evaluation Service] ${question.number}: mapped answer was not found. Saved as unanswered.`
      );

      const progress =
        80 +
        Math.round(
          (
            (
              index + 1
            ) /
            orderedQuestions.length
          ) *
            15
        );

      const updated =
        memoryStore.update(
          assessmentId,
          {
            progress: {
              currentStep:
                "evaluating_answers",

              progress,

              message:
                `Evaluated ${index + 1}/${orderedQuestions.length} questions.`,
            },

            status:
              "evaluating",
          }
        );

      if (
        updated
      ) {
        assessment =
          updated;
      }

      continue;
    }

    /**
     * --------------------------------------------------------
     * GROQ EVALUATION
     * --------------------------------------------------------
     */

    console.log(
      `[Evaluation Service] Evaluating ${question.number} (${index + 1}/${orderedQuestions.length})`
    );

    /**
     * If this request fails, the exception propagates.
     *
     * IMPORTANT:
     *
     * Previous question results have already been persisted.
     */
    const aiEvaluation =
      await evaluateAnswer({
        assessmentId,

        questionId:
          question.id,

        questionNumber:
          question.number,

        questionText:
          question.text,

        studentAnswer:
          answer.text,

        maxMarks,
      });

    /**
     * --------------------------------------------------------
     * CREATE RESULT
     * --------------------------------------------------------
     */

    const evaluationResult =
      createEvaluationResult(
        {
          assessmentId,

          questionId:
            question.id,

          questionNumber:
            question.number,

          questionText:
            question.text,

          studentAnswer:
            answer.text,

          maxMarks,
        },

        aiEvaluation,

        answer.id
      );

    /**
     * --------------------------------------------------------
     * SAVE IMMEDIATELY
     * --------------------------------------------------------
     *
     * This is the critical checkpoint.
     */

    assessment =
      saveEvaluationCheckpoint(
        assessmentId,
        evaluationResult
      );

    console.log(
      `[Evaluation Service] Saved ${question.number}: ${evaluationResult.score}/${maxMarks}`
    );

    /**
     * --------------------------------------------------------
     * PROGRESS
     * --------------------------------------------------------
     */

    const progress =
      80 +
      Math.round(
        (
          (
            index + 1
          ) /
          orderedQuestions.length
        ) *
          15
      );

    const updated =
      memoryStore.update(
        assessmentId,
        {
          progress: {
            currentStep:
              "evaluating_answers",

            progress,

            message:
              `Evaluated ${index + 1}/${orderedQuestions.length} questions.`,
          },

          status:
            "evaluating",

          error:
            undefined,

          updatedAt:
            new Date().toISOString(),
        }
      );

    if (
      updated
    ) {
      assessment =
        updated;
    }
  }

  /**
   * ==========================================================
   * FINALIZE
   * ==========================================================
   */

  const latest =
    memoryStore.getById(
      assessmentId
    );

  if (!latest) {
    throw new Error(
      "Assessment not found while finalizing evaluation."
    );
  }

  /**
   * Use persisted evaluations.
   */
  const evaluations =
    latest.evaluations ??
    [];

  const summary =
    buildEvaluationSummary(
      latest,
      evaluations
    );

  /**
   * Make sure every question has an evaluation result.
   */
  if (
    evaluations.length <
    latest.questions.length
  ) {
    const incomplete =
      memoryStore.update(
        assessmentId,
        {
          evaluationSummary:
            summary,

          status:
            "evaluating",

          progress: {
            currentStep:
              "evaluating_answers",

            progress:
              95,

            message:
              `Evaluation is incomplete: ${evaluations.length}/${latest.questions.length} questions processed.`,
          },

          updatedAt:
            new Date().toISOString(),
        }
      );

    if (
      !incomplete
    ) {
      throw new Error(
        "Failed to save incomplete evaluation state."
      );
    }

    return incomplete;
  }

  /**
   * ----------------------------------------------------------
   * All questions evaluated.
   * ----------------------------------------------------------
   */

  const completed =
    memoryStore.update(
      assessmentId,
      {
        evaluations,

        evaluationSummary:
          summary,

        status:
          "completed",

        progress: {
          currentStep:
            "completed",

          progress:
            100,

          message:
            `Evaluation completed. Score: ${summary.obtainedMarks}/${summary.totalMarks}.`,
        },

        error:
          undefined,

        updatedAt:
          new Date().toISOString(),
      }
    );

  if (!completed) {
    throw new Error(
      "Failed to save final evaluation results."
    );
  }

  console.log(
    [
      "[Evaluation Service] Evaluation completed.",

      `Questions: ${summary.totalQuestions}`,

      `Evaluated: ${summary.evaluatedQuestions}`,

      `Unanswered: ${summary.unansweredQuestions}`,

      `Score: ${summary.obtainedMarks}/${summary.totalMarks}`,

      `Percentage: ${summary.percentage}%`,
    ].join(" | ")
  );

  return completed;
}

/**
 * ============================================================
 * EVALUATE ONE QUESTION
 * ============================================================
 *
 * Development/testing helper.
 *
 * Performs exactly one Groq evaluation if a matched answer
 * exists.
 */
export async function evaluateSingleQuestion(
  assessmentId: string,
  questionId: string
): Promise<EvaluationResult> {
  const assessment =
    memoryStore.getById(
      assessmentId
    );

  if (!assessment) {
    throw new Error(
      "Assessment not found."
    );
  }

  const question =
    assessment.questions.find(
      (
        item
      ) =>
        item.id ===
        questionId
    );

  if (!question) {
    throw new Error(
      "Question not found."
    );
  }

  const maxMarks =
    getMaxMarks(
      question.maxMarks,
      question.number
    );

  const mapping =
    assessment.mappings.find(
      (
        item
      ) =>
        item.questionId ===
          questionId &&
        item.status ===
          "matched" &&
        Boolean(
          item.answerId
        )
    );

  /**
   * ----------------------------------------------------------
   * UNANSWERED
   * ----------------------------------------------------------
   */

  if (
    !mapping?.answerId
  ) {
    const result =
      createUnansweredEvaluation(
        assessmentId,

        question.id,

        question.number,

        maxMarks
      );

    const latest =
      memoryStore.getById(
        assessmentId
      );

    if (
      !latest
    ) {
      throw new Error(
        "Assessment not found while saving evaluation."
      );
    }

    const existingEvaluations =
      (
        latest.evaluations ??
        []
      ).filter(
        (
          item
        ) =>
          item.questionId !==
          questionId
      );

    const updated =
      memoryStore.update(
        assessmentId,
        {
          evaluations: [
            ...existingEvaluations,
            result,
          ],
        }
      );

    if (
      !updated
    ) {
      throw new Error(
        "Failed to save single-question evaluation."
      );
    }

    return result;
  }

  /**
   * ----------------------------------------------------------
   * RESOLVE ANSWER
   * ----------------------------------------------------------
   */

  const answer =
    assessment.answers.find(
      (
        item
      ) =>
        item.id ===
        mapping.answerId
    );

  if (
    !answer
  ) {
    throw new Error(
      "Mapped answer not found."
    );
  }

  /**
   * ----------------------------------------------------------
   * GROQ
   * ----------------------------------------------------------
   */

  const aiEvaluation =
    await evaluateAnswer({
      assessmentId,

      questionId:
        question.id,

      questionNumber:
        question.number,

      questionText:
        question.text,

      studentAnswer:
        answer.text,

      maxMarks,
    });

  const result =
    createEvaluationResult(
      {
        assessmentId,

        questionId:
          question.id,

        questionNumber:
          question.number,

        questionText:
          question.text,

        studentAnswer:
          answer.text,

        maxMarks,
      },

      aiEvaluation,

      answer.id
    );

  /**
   * ----------------------------------------------------------
   * SAVE SINGLE RESULT
   * ----------------------------------------------------------
   */

  const latest =
    memoryStore.getById(
      assessmentId
    );

  if (!latest) {
    throw new Error(
      "Assessment not found while saving single-question evaluation."
    );
  }

  const evaluations =
    [
      ...(latest.evaluations ??
        []).filter(
        (
          item
        ) =>
          item.questionId !==
          questionId
      ),

      result,
    ].sort(
      (
        a,
        b
      ) => {
        const questionA =
          assessment.questions.find(
            (
              item
            ) =>
              item.id ===
              a.questionId
          );

        const questionB =
          assessment.questions.find(
            (
              item
            ) =>
              item.id ===
              b.questionId
          );

        return (
          (
            questionA?.order ??
            Number.MAX_SAFE_INTEGER
          ) -
          (
            questionB?.order ??
            Number.MAX_SAFE_INTEGER
          )
        );
      }
    );

  const updated =
    memoryStore.update(
      assessmentId,
      {
        evaluations,
      }
    );

  if (
    !updated
  ) {
    throw new Error(
      "Failed to save single-question evaluation."
    );
  }

  return result;
}

/**
 * ============================================================
 * GET EVALUATION RESULTS
 * ============================================================
 */

export function getEvaluationResults(
  assessmentId: string
): EvaluationResult[] {
  const assessment =
    memoryStore.getById(
      assessmentId
    );

  if (!assessment) {
    throw new Error(
      "Assessment not found."
    );
  }

  return (
    assessment.evaluations ??
    []
  );
}

/**
 * ============================================================
 * GET EVALUATION SUMMARY
 * ============================================================
 */

export function getEvaluationSummary(
  assessmentId: string
): AssessmentEvaluationSummary {
  const assessment =
    memoryStore.getById(
      assessmentId
    );

  if (!assessment) {
    throw new Error(
      "Assessment not found."
    );
  }

  if (
    assessment.evaluationSummary
  ) {
    return assessment.evaluationSummary;
  }

  return buildEvaluationSummary(
    assessment,
    assessment.evaluations ??
      []
  );
}