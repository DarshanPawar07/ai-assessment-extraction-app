import { Assessment } from "../types/assessment";

import {
  memoryStore,
} from "../storage/memory.store";

import {
  extractAllQuestions,
  extractAnswerPagesForAssessment,
} from "./extraction.service";

import {
  mapAssessmentAnswers,
} from "./mapping.service";

import {
  evaluateAssessment,
} from "./evaluation.service";

/**
 * Number of answer-sheet pages processed per
 * orchestration request/chunk.
 */
const DEFAULT_ANSWER_PAGE_CHUNK_SIZE = 7;

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

function getAssessmentOrThrow(
  assessmentId: string
): Assessment {
  const assessment =
    memoryStore.getById(
      assessmentId
    );

  if (!assessment) {
    throw new Error(
      "Assessment not found."
    );
  }

  return assessment;
}

function getCompletedAnswerPages(
  assessment: Assessment
): number[] {
  const totalPages =
    assessment.answerSheet.pageCount;

  return [
    ...new Set(
      assessment.answerExtraction
        ?.completedPages ?? []
    ),
  ]
    .filter(
      (page) =>
        page >= 1 &&
        page <= totalPages
    )
    .sort(
      (a, b) =>
        a - b
    );
}

function getNextAnswerPage(
  assessment: Assessment
): number {
  const totalPages =
    assessment.answerSheet.pageCount;

  const completed =
    new Set(
      getCompletedAnswerPages(
        assessment
      )
    );

  /**
   * Prefer persisted nextPage only if it points
   * to a genuinely incomplete page.
   */
  const persistedNextPage =
    assessment.answerExtraction
      ?.nextPage;

  if (
    typeof persistedNextPage ===
      "number" &&
    persistedNextPage >= 1 &&
    persistedNextPage <=
      totalPages &&
    !completed.has(
      persistedNextPage
    )
  ) {
    return persistedNextPage;
  }

  /**
   * Always derive a safe fallback from completed pages.
   */
  const firstIncomplete =
    assessment.answerSheet.pages.find(
      (
        page
      ) =>
        !completed.has(
          page.pageNumber
        )
    );

  return (
    firstIncomplete?.pageNumber ??
    totalPages + 1
  );
}

function hasQuestions(
  assessment: Assessment
): boolean {
  return (
    assessment.questions.length >
    0
  );
}

function hasMappings(
  assessment: Assessment
): boolean {
  return (
    assessment.mappings.length >
    0
  );
}

function hasCompleteEvaluation(
  assessment: Assessment
): boolean {
  const totalQuestions =
    assessment.questions.length;

  const evaluationCount =
    assessment.evaluations?.length ??
    0;

  return (
    totalQuestions > 0 &&
    evaluationCount >=
      totalQuestions
  );
}

function areAllAnswerPagesComplete(
  assessment: Assessment
): boolean {
  const totalPages =
    assessment.answerSheet.pageCount;

  const completedPages =
    getCompletedAnswerPages(
      assessment
    );

  return (
    completedPages.length >=
      totalPages &&
    completedPages.every(
      (
        page
      ) =>
        page >= 1 &&
        page <= totalPages
    )
  );
}

/**
 * ============================================================
 * MAIN ORCHESTRATOR
 * ============================================================
 */

export async function processAssessment(
  assessmentId: string
): Promise<Assessment> {
  let assessment =
    getAssessmentOrThrow(
      assessmentId
    );

  console.log(
    "\n========================================"
  );

  console.log(
    `[Process] Starting assessment ${assessmentId}`
  );

  console.log(
    "========================================\n"
  );

  /**
   * ==========================================================
   * STEP 1 — QUESTION EXTRACTION
   * ==========================================================
   */

  if (
    !hasQuestions(
      assessment
    )
  ) {
    console.log(
      "[Process] Questions are missing. Starting question extraction."
    );

    const before =
      memoryStore.update(
        assessmentId,
        {
          status:
            "processing",

          progress: {
            currentStep:
              "extracting_questions",

            progress:
              20,

            message:
              "Extracting questions from question paper.",
          },

          error:
            undefined,
        }
      );

    if (
      !before
    ) {
      throw new Error(
        "Failed to update assessment before question extraction."
      );
    }

    assessment =
      before;

    const questions =
      await extractAllQuestions(
        assessment
      );

    if (
      questions.length ===
      0
    ) {
      throw new Error(
        "Question extraction completed but no questions were found."
      );
    }

    const updated =
      memoryStore.update(
        assessmentId,
        {
          questions,

          status:
            "processing",

          progress: {
            currentStep:
              "processing",

            progress:
              30,

            message:
              `Extracted ${questions.length} questions successfully.`,
          },

          error:
            undefined,
        }
      );

    if (
      !updated
    ) {
      throw new Error(
        "Failed to save extracted questions."
      );
    }

    assessment =
      updated;

    console.log(
      `[Process] Question extraction complete: ${questions.length} questions.`
    );
  } else {
    console.log(
      `[Process] Questions already exist (${assessment.questions.length}). Skipping question extraction.`
    );
  }

  /**
   * ==========================================================
   * STEP 2 — ANSWER EXTRACTION
   * ==========================================================
   *
   * Resumable.
   *
   * IMPORTANT:
   * completedPages is the source of truth.
   */

  assessment =
    getAssessmentOrThrow(
      assessmentId
    );

  const totalAnswerPages =
    assessment.answerSheet.pageCount;

  while (
    !areAllAnswerPagesComplete(
      assessment
    )
  ) {
    assessment =
      getAssessmentOrThrow(
        assessmentId
      );

    const nextPage =
      getNextAnswerPage(
        assessment
      );

    if (
      nextPage >
      totalAnswerPages
    ) {
      break;
    }

    const chunkEnd =
      Math.min(
        nextPage +
          DEFAULT_ANSWER_PAGE_CHUNK_SIZE -
          1,

        totalAnswerPages
      );

    console.log(
      [
        "[Process] Answer extraction:",
        `pages ${nextPage}-${chunkEnd}`,
        `of ${totalAnswerPages}`,
      ].join(" ")
    );

    try {
      await extractAnswerPagesForAssessment(
        assessmentId,
        nextPage,
        chunkEnd
      );
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : "Answer extraction failed.";

      console.error(
        `[Process] Answer extraction stopped: ${message}`
      );

      throw error;
    }

    assessment =
      getAssessmentOrThrow(
        assessmentId
      );

    const completed =
      getCompletedAnswerPages(
        assessment
      );

    console.log(
      `[Process] Answer extraction checkpoint: ${completed.length}/${totalAnswerPages} pages complete.`
    );

    const nextAfterChunk =
      getNextAnswerPage(
        assessment
      );

    if (
      nextAfterChunk <=
        nextPage &&
      !areAllAnswerPagesComplete(
        assessment
      )
    ) {
      throw new Error(
        `Answer extraction checkpoint did not advance. Current page: ${nextPage}. Next page: ${nextAfterChunk}.`
      );
    }
  }

  /**
   * Verify answer extraction.
   */

  assessment =
    getAssessmentOrThrow(
      assessmentId
    );

  if (
    !areAllAnswerPagesComplete(
      assessment
    )
  ) {
    const completed =
      getCompletedAnswerPages(
        assessment
      );

    throw new Error(
      `Answer extraction is incomplete: ${completed.length}/${totalAnswerPages} pages completed.`
    );
  }

  if (
    assessment.answers.length ===
    0
  ) {
    throw new Error(
      "Answer extraction completed but produced no answer blocks."
    );
  }

  console.log(
    `[Process] Answer extraction complete: ${assessment.answers.length} logical answer(s).`
  );

  /**
   * ==========================================================
   * STEP 3 — MAPPING
   * ==========================================================
   */

  assessment =
    getAssessmentOrThrow(
      assessmentId
    );

  if (
    !hasMappings(
      assessment
    )
  ) {
    console.log(
      "[Process] Mappings are missing. Starting answer mapping."
    );

    assessment =
      await mapAssessmentAnswers(
        assessmentId
      );

    if (
      assessment.mappings.length ===
      0
    ) {
      throw new Error(
        "Answer mapping completed but no mappings were generated."
      );
    }

    console.log(
      `[Process] Mapping complete: ${assessment.mappings.length} mappings.`
    );
  } else {
    console.log(
      `[Process] Mappings already exist (${assessment.mappings.length}). Skipping mapping.`
    );
  }

  /**
   * ==========================================================
   * STEP 4 — EVALUATION
   * ==========================================================
   */

  assessment =
    getAssessmentOrThrow(
      assessmentId
    );

  if (
    !hasCompleteEvaluation(
      assessment
    )
  ) {
    console.log(
      `[Process] Evaluation incomplete (${assessment.evaluations?.length ?? 0}/${assessment.questions.length}). Starting evaluation.`
    );

    assessment =
      await evaluateAssessment(
        assessmentId
      );

    console.log(
      "[Process] Evaluation complete."
    );
  } else {
    console.log(
      `[Process] Evaluation already complete (${assessment.evaluations.length}/${assessment.questions.length}). Skipping evaluation.`
    );
  }

  /**
   * ==========================================================
   * FINALIZE
   * ==========================================================
   */

  assessment =
    getAssessmentOrThrow(
      assessmentId
    );

  if (
    hasCompleteEvaluation(
      assessment
    )
  ) {
    const completed =
      memoryStore.update(
        assessmentId,
        {
          status:
            "completed",

          progress: {
            currentStep:
              "completed",

            progress:
              100,

            message:
              "Assessment processing completed successfully.",
          },

          error:
            undefined,
        }
      );

    if (
      !completed
    ) {
      throw new Error(
        "Failed to finalize assessment."
      );
    }

    console.log(
      "\n========================================"
    );

    console.log(
      "[Process] Assessment processing completed."
    );

    console.log(
      "========================================\n"
    );

    return completed;
  }

  return assessment;
}

/**
 * ============================================================
 * PROCESS STATUS
 * ============================================================
 */

export interface ProcessStatus {
  assessmentId: string;

  questionsComplete: boolean;

  answersComplete: boolean;

  mappingComplete: boolean;

  evaluationComplete: boolean;

  completedAnswerPages: number;

  totalAnswerPages: number;

  nextAnswerPage?: number;

  currentStep: string;

  progress: number;

  status: string;
}

export function getProcessStatus(
  assessmentId: string
): ProcessStatus {
  const assessment =
    getAssessmentOrThrow(
      assessmentId
    );

  const completedAnswerPages =
    getCompletedAnswerPages(
      assessment
    );

  const totalAnswerPages =
    assessment.answerSheet.pageCount;

  const questionsComplete =
    hasQuestions(
      assessment
    );

  const answersComplete =
    areAllAnswerPagesComplete(
      assessment
    );

  const mappingComplete =
    hasMappings(
      assessment
    );

  const evaluationComplete =
    hasCompleteEvaluation(
      assessment
    );

  const nextAnswerPage =
    answersComplete
      ? undefined
      : getNextAnswerPage(
          assessment
        );

  return {
    assessmentId,

    questionsComplete,

    answersComplete,

    mappingComplete,

    evaluationComplete,

    completedAnswerPages:
      completedAnswerPages.length,

    totalAnswerPages,

    nextAnswerPage,

    currentStep:
      assessment.progress
        .currentStep,

    progress:
      assessment.progress
        .progress,

    status:
      assessment.status,
  };
}

/**
 * ============================================================
 * DRY RUN
 * ============================================================
 */

export interface ProcessDryRun {
  assessmentId: string;

  wouldExtractQuestions: boolean;

  wouldExtractAnswers: boolean;

  wouldMapAnswers: boolean;

  wouldEvaluateAnswers: boolean;

  questionsCount: number;

  answersCount: number;

  mappingsCount: number;

  evaluationsCount: number;

  completedAnswerPages: number;

  totalAnswerPages: number;

  nextAnswerPage?: number;

  currentStatus: string;

  currentStep: string;

  currentProgress: number;
}

export function dryRunAssessmentProcess(
  assessmentId: string
): ProcessDryRun {
  const assessment =
    getAssessmentOrThrow(
      assessmentId
    );

  const completedAnswerPages =
    getCompletedAnswerPages(
      assessment
    );

  const totalAnswerPages =
    assessment.answerSheet.pageCount;

  const questionsComplete =
    hasQuestions(
      assessment
    );

  const answersComplete =
    areAllAnswerPagesComplete(
      assessment
    );

  const mappingsComplete =
    hasMappings(
      assessment
    );

  const evaluationComplete =
    hasCompleteEvaluation(
      assessment
    );

  return {
    assessmentId,

    wouldExtractQuestions:
      !questionsComplete,

    wouldExtractAnswers:
      !answersComplete,

    wouldMapAnswers:
      !mappingsComplete,

    wouldEvaluateAnswers:
      !evaluationComplete,

    questionsCount:
      assessment.questions.length,

    answersCount:
      assessment.answers.length,

    mappingsCount:
      assessment.mappings.length,

    evaluationsCount:
      assessment.evaluations?.length ??
      0,

    completedAnswerPages:
      completedAnswerPages.length,

    totalAnswerPages,

    nextAnswerPage:
      answersComplete
        ? undefined
        : getNextAnswerPage(
            assessment
          ),

    currentStatus:
      assessment.status,

    currentStep:
      assessment.progress.currentStep,

    currentProgress:
      assessment.progress.progress,
  };
}