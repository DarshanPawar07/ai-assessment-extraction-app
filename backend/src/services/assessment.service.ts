import crypto from "crypto";

import {
  Assessment,
  AssessmentStatus,
} from "../types/assessment";

import {
  extractAllQuestions,
} from "./extraction.service";

import {
  extractAndAggregateAnswers,
} from "./extraction.service";

import {
  extractAnswersFromPage,
} from "../ai/groq/answer-extractor";

import {
  sleep,
} from "../ai/groq/rate-limit";

import {
  memoryStore,
} from "../storage/memory.store";

import {
  processDocumentFile,
} from "../document/process-document";

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

/**
 * Create a processing progress object.
 */
function createProgress(
  currentStep: AssessmentStatus,
  progress: number,
  message: string
) {
  return {
    currentStep,
    progress,
    message,
  };
}

/**
 * Update assessment timestamps whenever an
 * assessment is changed.
 */
function updateAssessment(
  assessmentId: string,
  updates: Partial<Assessment>
): Assessment | undefined {
  return memoryStore.update(
    assessmentId,
    {
      ...updates,

      updatedAt:
        new Date().toISOString(),
    }
  );
}

/**
 * ============================================================
 * CREATE ASSESSMENT
 * ============================================================
 */

/**
 * Creates the assessment and preprocesses both
 * uploaded documents.
 */
export async function createAssessment(
  questionPaper: Express.Multer.File,
  answerSheet: Express.Multer.File
): Promise<Assessment> {
  const now =
    new Date().toISOString();

  const questionDocumentId =
    crypto.randomUUID();

  const answerDocumentId =
    crypto.randomUUID();

  /**
   * Convert question paper into processed
   * page images and metadata.
   */
  const questionPaperDocument =
    await processDocumentFile(
      questionPaper,
      questionDocumentId
    );

  /**
   * Convert answer sheet into processed
   * page images and metadata.
   */
  const answerSheetDocument =
    await processDocumentFile(
      answerSheet,
      answerDocumentId
    );

  const assessment: Assessment = {
    id: crypto.randomUUID(),

    status: "created",

    progress:
      createProgress(
        "created",
        0,
        "Assessment created successfully."
      ),

    questionPaper:
      questionPaperDocument,

    answerSheet:
      answerSheetDocument,

    questions: [],

    answers: [],

    mappings: [],
    evaluations: [],

    createdAt: now,

    updatedAt: now,
  };

  memoryStore.create(
    assessment
  );

  return assessment;
}

/**
 * ============================================================
 * GET ASSESSMENT
 * ============================================================
 */

export function getAssessmentById(
  assessmentId: string
): Assessment | undefined {
  return memoryStore.getById(
    assessmentId
  );
}

/**
 * ============================================================
 * UPDATE STATUS
 * ============================================================
 */

export function updateAssessmentStatus(
  assessmentId: string,
  status: AssessmentStatus,
  progress: number,
  message: string
): Assessment | undefined {
  return updateAssessment(
    assessmentId,
    {
      status,

      progress:
        createProgress(
          status,
          progress,
          message
        ),
    }
  );
}

/**
 * ============================================================
 * MARK FAILED
 * ============================================================
 */

export function markAssessmentFailed(
  assessmentId: string,
  error: string
): Assessment | undefined {
  return updateAssessment(
    assessmentId,
    {
      status: "failed",

      progress:
        createProgress(
          "failed",
          100,
          "Assessment processing failed."
        ),

      error,
    }
  );
}

/**
 * ============================================================
 * QUESTION EXTRACTION
 * ============================================================
 */

export async function extractQuestionsForAssessment(
  assessmentId: string
): Promise<Assessment> {
  const assessment =
    memoryStore.getById(
      assessmentId
    );

  if (!assessment) {
    throw new Error(
      "Assessment not found."
    );
  }

  updateAssessment(
    assessmentId,
    {
      status:
        "extracting_questions",

      progress:
        createProgress(
          "extracting_questions",
          20,
          "Extracting questions from the question paper."
        ),
    }
  );

  try {
    const questions =
      await extractAllQuestions(
        assessment
      );

    const updatedAssessment =
      updateAssessment(
        assessmentId,
        {
          status: "processing",

          progress:
            createProgress(
              "processing",
              30,
              `Extracted ${questions.length} questions successfully.`
            ),

          questions,
        }
      );

    if (!updatedAssessment) {
      throw new Error(
        "Failed to update assessment after question extraction."
      );
    }

    return updatedAssessment;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Question extraction failed.";

    markAssessmentFailed(
      assessmentId,
      message
    );

    throw error;
  }
}

/**
 * ============================================================
 * FULL ANSWER EXTRACTION
 * ============================================================
 *
 * This is the production-style entry point.
 *
 * It:
 * 1. Validates questions exist.
 * 2. Extracts all answer pages.
 * 3. Tracks active questions.
 * 4. Aggregates multi-page answers.
 */
export async function extractAnswersForAssessment(
  assessmentId: string
): Promise<Assessment> {
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
    assessment.questions.length === 0
  ) {
    throw new Error(
      "Questions must be extracted before answers."
    );
  }

  updateAssessment(
    assessmentId,
    {
      status:
        "extracting_answers",

      progress:
        createProgress(
          "extracting_answers",
          40,
          "Extracting answers from the answer sheet."
        ),
    }
  );

  try {
    /**
     * Current extraction service processes the
     * entire answer sheet page by page using
     * Groq.
     */
    const answers =
      await extractAndAggregateAnswers(
        assessment
      );

    const updatedAssessment =
      updateAssessment(
        assessmentId,
        {
          status: "processing",

          progress:
            createProgress(
              "processing",
              60,
              `Extracted ${answers.length} logical answers successfully.`
            ),

          answers,
        }
      );

    if (!updatedAssessment) {
      throw new Error(
        "Failed to update assessment after answer extraction."
      );
    }

    return updatedAssessment;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Answer extraction failed.";

    markAssessmentFailed(
      assessmentId,
      message
    );

    throw error;
  }
}

/**
 * ============================================================
 * TEST / PAGE-RANGE ANSWER EXTRACTION
 * ============================================================
 *
 * Used during development so we can test
 * selected answer-sheet pages without
 * processing all 44 pages.
 */
export async function extractAnswerPagesForAssessment(
  assessmentId: string,
  startPage: number,
  endPage: number
): Promise<Assessment> {
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
    assessment.questions.length === 0
  ) {
    throw new Error(
      "Questions must be extracted before answers."
    );
  }

  const totalPages =
    assessment.answerSheet
      .pages.length;

  if (
    startPage < 1 ||
    endPage > totalPages ||
    startPage > endPage
  ) {
    throw new Error(
      `Invalid page range. Available answer-sheet pages: 1-${totalPages}.`
    );
  }

  updateAssessment(
    assessmentId,
    {
      status:
        "extracting_answers",

      progress:
        createProgress(
          "extracting_answers",
          Math.max(
            40,
            Math.round(
              ((startPage - 1) /
                totalPages) *
                100
            )
          ),
          `Preparing answer extraction for pages ${startPage}-${endPage}.`
        ),
    }
  );

  /**
   * Valid question identifiers come directly
   * from the question paper.
   */
  const validQuestionNumbers =
    assessment.questions.map(
      (question) =>
        question.number
    );

  const pages =
    assessment.answerSheet.pages.filter(
      (page) =>
        page.pageNumber >= startPage &&
        page.pageNumber <= endPage
    );

  const pageAnswers = [];

  /**
   * IMPORTANT:
   *
   * If we start the range at page 3, we need
   * to know what question was active before
   * page 3.
   *
   * For our initial testing ranges we start
   * at page 1, so NONE is correct.
   *
   * Later, the full extraction path will
   * process the entire document in sequence.
   */
  let activeQuestion:
    | string
    | undefined;

  for (
    let index = 0;
    index < pages.length;
    index += 1
  ) {
    const page =
      pages[index];

    if (!page.imagePath) {
      throw new Error(
        `Answer sheet page ${page.pageNumber} has no image path.`
      );
    }

    console.log(
      `[Answer Extraction] Processing page ${page.pageNumber}/${totalPages}`
    );

    console.log(
      `[Answer Extraction] Active question: ${
        activeQuestion ??
        "NONE"
      }`
    );

    const answers =
      await extractAnswersFromPage({
        page: {
          imagePath:
            page.imagePath,

          pageNumber:
            page.pageNumber,

          imageWidth:
            page.width,

          imageHeight:
            page.height,
        },

        validQuestionNumbers,

        previousActiveQuestionNumber:
          activeQuestion,
      });

    pageAnswers.push(
      ...answers
    );

    /**
     * Update active question for the
     * next page.
     */
    for (
      const answer of answers
    ) {
      if (
        answer.explicitQuestionNumber
      ) {
        activeQuestion =
          answer.explicitQuestionNumber;

        continue;
      }

      if (
        answer.continuationOf
      ) {
        activeQuestion =
          answer.continuationOf;
      }
    }

    console.log(
      `[Answer Extraction] Page ${page.pageNumber} produced ${answers.length} answer block(s).`
    );

    console.log(
      `[Answer Extraction] Next active question: ${
        activeQuestion ??
        "NONE"
      }`
    );

    /**
     * Respect API request pacing.
     */
    if (
      index <
      pages.length - 1
    ) {
      await sleep(2500);
    }

    const processedPageCount =
      index + 1;

    const progress =
      40 +
      Math.round(
        (processedPageCount /
          pages.length) *
          20
      );

    updateAssessment(
      assessmentId,
      {
        status:
          "extracting_answers",

        progress:
          createProgress(
            "extracting_answers",
            Math.min(
              progress,
              60
            ),
            `Processed answer pages ${processedPageCount}/${pages.length} in selected range.`
          ),
      }
    );
  }

  /**
   * Preserve answers already extracted
   * previously.
   */
  const existingAnswers =
    assessment.answers ?? [];

  const mergedPageAnswers = [
    ...existingAnswers,
    ...pageAnswers,
  ];

  const updatedAssessment =
    updateAssessment(
      assessmentId,
      {
        status: "processing",

        progress:
          createProgress(
            "processing",
            60,
            `Extracted answer pages ${startPage}-${endPage}.`
          ),

        answers:
          mergedPageAnswers,
      }
    );

  if (!updatedAssessment) {
    throw new Error(
      "Failed to update assessment after answer page extraction."
    );
  }

  return updatedAssessment;
}