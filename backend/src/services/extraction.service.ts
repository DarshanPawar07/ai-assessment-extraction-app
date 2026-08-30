import { Assessment } from "../types/assessment";
import { Answer } from "../types/answer";
import { Question } from "../types/question";

import { extractQuestionsFromPage } from "../ai/question-extractor";

import {
  extractAnswersFromPage as extractGroqAnswersFromPage,
} from "../ai/groq/answer-extractor";

import { sleep } from "../ai/groq/rate-limit";

import { memoryStore } from "../storage/memory.store";

/**
 * ============================================================
 * INTERNAL HELPERS
 * ============================================================
 */

function updateAssessment(
  assessmentId: string,
  updates: Partial<Assessment>
): Assessment | undefined {
  return memoryStore.update(assessmentId, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

function createProgress(
  currentStep: string,
  progress: number,
  message: string
) {
  return {
    currentStep,
    progress: Math.max(0, Math.min(100, progress)),
    message,
  };
}

function createAnswerExtractionState(
  assessment: Assessment,
  nextPage: number,
  completedPages: number[],
  lastError?: string
) {
  const totalPages =
    assessment.answerSheet.pageCount;

  const sortedPages = [
    ...new Set(completedPages),
  ]
    .filter(
      (page) =>
        page >= 1 &&
        page <= totalPages
    )
    .sort(
      (a, b) => a - b
    );

  return {
    completedPages: sortedPages,
    nextPage,
    totalPages,

    lastCompletedPage:
      sortedPages.length > 0
        ? sortedPages[
            sortedPages.length - 1
          ]
        : undefined,

    lastError,

    updatedAt:
      new Date().toISOString(),
  };
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
      (a, b) => a - b
    );
}

function isRateLimitError(
  error: unknown
): boolean {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return (
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("429") ||
    message.includes("resource_exhausted") ||
    message.includes("tokens per day") ||
    message.includes("tokens per minute")
  );
}

/**
 * Normalize text for deterministic comparison.
 */
function normalizeText(
  value: string
): string {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

/**
 * ============================================================
 * QUESTION EXTRACTION
 * ============================================================
 */

function deduplicateQuestions(
  questions: Question[]
): Question[] {
  const seen =
    new Set<string>();

  const result: Question[] = [];

  for (
    const question of questions
  ) {
    const key = [
      question.number
        .trim()
        .toLowerCase(),

      question.text
        .trim()
        .toLowerCase(),
    ].join("|");

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    result.push(question);
  }

  return result;
}

function sortQuestions(
  questions: Question[]
): Question[] {
  return [
    ...questions,
  ].sort(
    (a, b) => {
      if (
        a.page !== b.page
      ) {
        return (
          a.page -
          b.page
        );
      }

      if (
        a.bbox.y !==
        b.bbox.y
      ) {
        return (
          a.bbox.y -
          b.bbox.y
        );
      }

      return (
        a.bbox.x -
        b.bbox.x
      );
    }
  );
}

function ensureUniqueQuestionIds(
  questions: Question[]
): Question[] {
  const usedIds =
    new Set<string>();

  return questions.map(
    (question) => {
      const baseId =
        question.id;

      let id =
        baseId;

      let counter = 2;

      while (
        usedIds.has(id)
      ) {
        id =
          `${baseId}-${counter}`;

        counter += 1;
      }

      usedIds.add(id);

      return {
        ...question,
        id,
      };
    }
  );
}

function normalizeQuestionOrder(
  questions: Question[]
): Question[] {
  return questions.map(
    (
      question,
      index
    ) => ({
      ...question,
      order: index,
    })
  );
}

export async function extractAllQuestions(
  assessment: Assessment
): Promise<Question[]> {
  const pages =
    assessment.questionPaper.pages;

  if (
    pages.length === 0
  ) {
    throw new Error(
      "Question paper contains no processed pages."
    );
  }

  const extractedQuestions:
    Question[] = [];

  for (
    const page of pages
  ) {
    if (
      !page.imagePath
    ) {
      throw new Error(
        `Question paper page ${page.pageNumber} has no image path.`
      );
    }

    const pageQuestions =
      await extractQuestionsFromPage({
        imagePath:
          page.imagePath,

        pageNumber:
          page.pageNumber,

        imageWidth:
          page.width,

        imageHeight:
          page.height,
      });

    extractedQuestions.push(
      ...pageQuestions
    );
  }

  const deduplicated =
    deduplicateQuestions(
      extractedQuestions
    );

  const sorted =
    sortQuestions(
      deduplicated
    );

  const unique =
    ensureUniqueQuestionIds(
      sorted
    );

  return normalizeQuestionOrder(
    unique
  );
}

/**
 * ============================================================
 * ACTIVE QUESTION STATE
 * ============================================================
 */

function updateActiveQuestion(
  answers: Answer[],
  currentActiveQuestion?: string
): string | undefined {
  let activeQuestion =
    currentActiveQuestion;

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

  return activeQuestion;
}

/**
 * ============================================================
 * CREATE / APPEND LOGICAL ANSWERS
 * ============================================================
 */

function createLogicalAnswer(
  answer: Answer,
  questionNumber: string
): Answer {
  const safeId =
    questionNumber
      .replace(
        /[^a-zA-Z0-9]+/g,
        "-"
      )
      .replace(
        /^-|-$/g,
        ""
      )
      .toLowerCase();

  return {
    id:
      `logical-${safeId}`,

    text:
      answer.text.trim(),

    studentQuestionNumber:
      answer.studentQuestionNumber,

    explicitQuestionNumber:
      questionNumber,

    continuationOf:
      undefined,

    regions:
      [...answer.regions],

    order:
      answer.order,

    extractionConfidence:
      answer.extractionConfidence,
  };
}

function appendToLogicalAnswer(
  group: Answer,
  answer: Answer
): void {
  const text =
    answer.text.trim();

  if (text) {
    group.text =
      `${group.text}\n\n${text}`.trim();
  }

  group.regions.push(
    ...answer.regions
  );

  if (
    !group.studentQuestionNumber &&
    answer.studentQuestionNumber
  ) {
    group.studentQuestionNumber =
      answer.studentQuestionNumber;
  }

  if (
    typeof answer.extractionConfidence ===
    "number"
  ) {
    group.extractionConfidence =
      Math.max(
        group.extractionConfidence ??
          0,
        answer.extractionConfidence
      );
  }
}

/**
 * ============================================================
 * FIND QUESTION BY ANSWER CONTENT
 * ============================================================
 */

function findQuestionByAnswerText(
  answer: Answer,
  questions: Question[]
): Question | undefined {
  if (
    questions.length === 0
  ) {
    return undefined;
  }

  const answerText =
    normalizeText(
      answer.text
    );

  if (
    !answerText
  ) {
    return undefined;
  }

  for (
    const question of questions
  ) {
    const questionText =
      normalizeText(
        question.text
      );

    if (
      !questionText
    ) {
      continue;
    }

    if (
      answerText.includes(
        questionText
      )
    ) {
      return question;
    }
  }

  for (
    const question of questions
  ) {
    const questionText =
      normalizeText(
        question.text
      );

    if (
      questionText.length < 20
    ) {
      continue;
    }

    const questionPrefix =
      questionText.slice(
        0,
        Math.min(
          60,
          questionText.length
        )
      );

    if (
      answerText.includes(
        questionPrefix
      )
    ) {
      return question;
    }
  }

  return undefined;
}

/**
 * ============================================================
 * LOGICAL ANSWER AGGREGATION
 * ============================================================
 */

export function aggregateLogicalAnswers(
  pageAnswers: Answer[],
  questions: Question[] = []
): Answer[] {
  if (
    pageAnswers.length === 0
  ) {
    return [];
  }

  const ordered =
    [...pageAnswers].sort(
      (a, b) => {
        const pageA =
          a.regions[0]?.page ??
          Number.MAX_SAFE_INTEGER;

        const pageB =
          b.regions[0]?.page ??
          Number.MAX_SAFE_INTEGER;

        if (
          pageA !== pageB
        ) {
          return (
            pageA -
            pageB
          );
        }

        return (
          a.order -
          b.order
        );
      }
    );

  const groups =
    new Map<string, Answer>();

  const unresolved:
    Answer[] = [];

  for (
    let index = 0;
    index <
    ordered.length;
    index += 1
  ) {
    const answer =
      ordered[index];

    const page =
      answer.regions[0]?.page;

    const hasStudentLabel =
      typeof answer.studentQuestionNumber ===
        "string" &&
      answer.studentQuestionNumber
        .trim()
        .length > 0;

    /**
     * CASE 1:
     * Explicit canonical question number.
     */
    if (
      answer.explicitQuestionNumber
    ) {
      const key =
        answer.explicitQuestionNumber;

      const existing =
        groups.get(key);

      if (
        existing
      ) {
        appendToLogicalAnswer(
          existing,
          answer
        );
      } else {
        groups.set(
          key,
          createLogicalAnswer(
            answer,
            key
          )
        );
      }

      continue;
    }

    /**
     * CASE 2:
     * Visible student label.
     */
    if (
      hasStudentLabel
    ) {
      const matchedQuestion =
        findQuestionByAnswerText(
          answer,
          questions
        );

      if (
        matchedQuestion
      ) {
        const key =
          matchedQuestion.number;

        const existing =
          groups.get(key);

        if (
          existing
        ) {
          appendToLogicalAnswer(
            existing,
            answer
          );
        } else {
          groups.set(
            key,
            createLogicalAnswer(
              answer,
              key
            )
          );
        }

        continue;
      }

      let resolvedByLookAhead =
        false;

      if (
        index <
        ordered.length - 1
      ) {
        const nextAnswer =
          ordered[
            index + 1
          ];

        const nextPage =
          nextAnswer.regions[0]?.page;

        const nextContinuation =
          nextAnswer.continuationOf;

        const adjacentPages =
          typeof page ===
            "number" &&
          typeof nextPage ===
            "number" &&
          nextPage ===
            page + 1;

        if (
          nextContinuation &&
          adjacentPages
        ) {
          const existing =
            groups.get(
              nextContinuation
            );

          if (
            existing
          ) {
            appendToLogicalAnswer(
              existing,
              answer
            );
          } else {
            groups.set(
              nextContinuation,
              createLogicalAnswer(
                answer,
                nextContinuation
              )
            );
          }

          resolvedByLookAhead =
            true;
        }
      }

      if (
        resolvedByLookAhead
      ) {
        continue;
      }

      unresolved.push(
        answer
      );

      continue;
    }

    /**
     * CASE 3:
     * No student label.
     */

    const previousAnswer =
      index > 0
        ? ordered[
            index - 1
          ]
        : undefined;

    const previousPage =
      previousAnswer
        ?.regions[0]?.page;

    const isAdjacent =
      typeof page ===
        "number" &&
      typeof previousPage ===
        "number" &&
      page ===
        previousPage + 1;

    let adjacentGroup:
      | Answer
      | undefined;

    if (
      isAdjacent
    ) {
      for (
        const group of
          groups.values()
      ) {
        const lastRegion =
          group.regions[
            group.regions.length -
              1
          ];

        if (
          lastRegion &&
          lastRegion.page ===
            previousPage
        ) {
          adjacentGroup =
            group;

          break;
        }
      }
    }

    if (
      adjacentGroup
    ) {
      appendToLogicalAnswer(
        adjacentGroup,
        answer
      );

      continue;
    }

    if (
      answer.continuationOf
    ) {
      const key =
        answer.continuationOf;

      const existing =
        groups.get(key);

      if (
        existing
      ) {
        appendToLogicalAnswer(
          existing,
          answer
        );
      } else {
        groups.set(
          key,
          createLogicalAnswer(
            answer,
            key
          )
        );
      }

      continue;
    }

    unresolved.push(
      answer
    );
  }

  for (
    const answer of unresolved
  ) {
    groups.set(
      `unmatched-${answer.id}`,
      {
        ...answer,

        id:
          `logical-unmatched-${answer.id}`,

        explicitQuestionNumber:
          undefined,

        continuationOf:
          undefined,
      }
    );
  }

  return Array.from(
    groups.values()
  )
    .sort(
      (a, b) => {
        const pageA =
          a.regions[0]?.page ??
          Number.MAX_SAFE_INTEGER;

        const pageB =
          b.regions[0]?.page ??
          Number.MAX_SAFE_INTEGER;

        if (
          pageA !== pageB
        ) {
          return (
            pageA -
            pageB
          );
        }

        const yA =
          a.regions[0]?.bbox.y ??
          Number.MAX_SAFE_INTEGER;

        const yB =
          b.regions[0]?.bbox.y ??
          Number.MAX_SAFE_INTEGER;

        if (
          yA !== yB
        ) {
          return (
            yA -
            yB
          );
        }

        return (
          a.order -
          b.order
        );
      }
    )
    .map(
      (
        answer,
        index
      ) => ({
        ...answer,
        order: index,
      })
    );
}

/**
 * ============================================================
 * FULL ANSWER EXTRACTION
 * ============================================================
 */

export async function extractAllAnswers(
  assessment: Assessment
): Promise<Answer[]> {
  const pages =
    assessment.answerSheet.pages;

  if (
    pages.length === 0
  ) {
    throw new Error(
      "Answer sheet contains no processed pages."
    );
  }

  if (
    assessment.questions.length === 0
  ) {
    throw new Error(
      "Questions must be extracted before answers."
    );
  }

  const validQuestionNumbers =
    assessment.questions.map(
      (
        question
      ) =>
        question.number
    );

  const completedPages =
    getCompletedAnswerPages(
      assessment
    );

  const existingAnswers =
    assessment.answers ?? [];

  let activeQuestion:
    | string
    | undefined;

  for (
    const answer of existingAnswers
  ) {
    if (
      answer.explicitQuestionNumber
    ) {
      activeQuestion =
        answer.explicitQuestionNumber;
    } else if (
      answer.continuationOf
    ) {
      activeQuestion =
        answer.continuationOf;
    }
  }

  const firstIncomplete =
    pages.find(
      (
        page
      ) =>
        !completedPages.includes(
          page.pageNumber
        )
    );

  if (
    !firstIncomplete
  ) {
    return aggregateLogicalAnswers(
      existingAnswers,
      assessment.questions
    );
  }

  const newlyExtracted:
    Answer[] = [];

  for (
    const page of pages
  ) {
    if (
      completedPages.includes(
        page.pageNumber
      )
    ) {
      continue;
    }

    if (
      !page.imagePath
    ) {
      throw new Error(
        `Answer sheet page ${page.pageNumber} has no image path.`
      );
    }

    console.log(
      `[Answer Extraction] Processing page ${page.pageNumber}/${pages.length}`
    );

    console.log(
      `[Answer Extraction] Active question: ${
        activeQuestion ??
        "NONE"
      }`
    );

    const latestBeforePage =
      memoryStore.getById(
        assessment.id
      );

    if (
      !latestBeforePage
    ) {
      throw new Error(
        "Assessment not found while processing answers."
      );
    }

    updateAssessment(
      assessment.id,
      {
        status:
          "extracting_answers",

        progress:
          createProgress(
            "extracting_answers",

            Math.round(
              (
                completedPages.length /
                pages.length
              ) *
                100
            ),

            `Processing answer page ${page.pageNumber}/${pages.length}.`
          ),

        answerExtraction:
          createAnswerExtractionState(
            latestBeforePage,
            page.pageNumber,
            completedPages
          ),
      }
    );

    try {
      const extractedAnswers =
        await extractGroqAnswersFromPage({
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

      newlyExtracted.push(
        ...extractedAnswers
      );

      activeQuestion =
        updateActiveQuestion(
          extractedAnswers,
          activeQuestion
        );

      completedPages.push(
        page.pageNumber
      );

      const physicalAnswers =
        [
          ...existingAnswers,
          ...newlyExtracted,
        ];

      const logicalAnswers =
        aggregateLogicalAnswers(
          physicalAnswers,
          assessment.questions
        );

      const nextPage =
        pages.find(
          (
            candidate
          ) =>
            !completedPages.includes(
              candidate.pageNumber
            )
        )?.pageNumber ??
        pages.length + 1;

      const latest =
        memoryStore.getById(
          assessment.id
        );

      if (
        !latest
      ) {
        throw new Error(
          "Assessment not found while saving answer checkpoint."
        );
      }

      const checkpointed =
        updateAssessment(
          assessment.id,
          {
            status:
              nextPage >
              pages.length
                ? "processing"
                : "extracting_answers",

            answers:
              logicalAnswers,

            answerExtraction:
              createAnswerExtractionState(
                latest,
                nextPage,
                completedPages
              ),

            progress:
              createProgress(
                "extracting_answers",

                Math.round(
                  (
                    completedPages.length /
                    pages.length
                  ) *
                    100
                ),

                `Completed answer page ${page.pageNumber}/${pages.length}.`
              ),
          }
        );

      if (
        !checkpointed
      ) {
        throw new Error(
          `Failed to checkpoint answer page ${page.pageNumber}.`
        );
      }

      console.log(
        `[Answer Extraction] Page ${page.pageNumber} completed successfully.`
      );

      console.log(
        `[Answer Extraction] Next page: ${
          nextPage <=
          pages.length
            ? nextPage
            : "NONE"
        }`
      );

      if (
        nextPage <=
        pages.length
      ) {
        await sleep(
          2500
        );
      }
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : "Answer extraction failed.";

      const rateLimited =
        isRateLimitError(
          error
        );

      const latest =
        memoryStore.getById(
          assessment.id
        );

      if (
        latest
      ) {
        updateAssessment(
          assessment.id,
          {
            status:
              rateLimited
                ? "rate_limited"
                : "failed",

            answerExtraction:
              createAnswerExtractionState(
                latest,
                page.pageNumber,
                completedPages,
                message
              ),

            progress:
              createProgress(
                rateLimited
                  ? "rate_limited"
                  : "failed",

                Math.round(
                  (
                    completedPages.length /
                    pages.length
                  ) *
                    100
                ),

                rateLimited
                  ? `Answer extraction paused at page ${page.pageNumber} because of a Groq rate limit.`
                  : `Answer extraction failed on page ${page.pageNumber}.`
              ),

            error:
              message,
          }
        );
      }

      throw error;
    }
  }

  const latest =
    memoryStore.getById(
      assessment.id
    );

  const finalAnswers =
    aggregateLogicalAnswers(
      latest?.answers ??
        [
          ...existingAnswers,
          ...newlyExtracted,
        ],
      assessment.questions
    );

  updateAssessment(
    assessment.id,
    {
      status:
        "processing",

      answers:
        finalAnswers,

      answerExtraction: {
        completedPages:
          [
            ...new Set(
              completedPages
            ),
          ]
            .filter(
              (page) =>
                page >= 1 &&
                page <= pages.length
            )
            .sort(
              (a, b) =>
                a - b
            ),

        nextPage:
          pages.length + 1,

        totalPages:
          pages.length,

        lastCompletedPage:
          pages.length,

        lastError:
          undefined,

        updatedAt:
          new Date().toISOString(),
      },

      progress:
        createProgress(
          "processing",
          65,
          `All ${pages.length} answer pages extracted and aggregated.`
        ),

      error:
        undefined,
    }
  );

  return finalAnswers;
}

/**
 * ============================================================
 * PAGE-RANGE ANSWER EXTRACTION
 * ============================================================
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

  if (
    !assessment
  ) {
    throw new Error(
      "Assessment not found."
    );
  }

  if (
    assessment.questions.length ===
    0
  ) {
    throw new Error(
      "Questions must be extracted before answers."
    );
  }

  const totalPages =
    assessment.answerSheet.pageCount;

  if (
    startPage < 1 ||
    endPage >
      totalPages ||
    startPage >
      endPage
  ) {
    throw new Error(
      `Invalid page range. Available answer-sheet pages: 1-${totalPages}.`
    );
  }

  const pages =
    assessment.answerSheet.pages.filter(
      (
        page
      ) =>
        page.pageNumber >=
          startPage &&
        page.pageNumber <=
          endPage
    );

  if (
    pages.length ===
    0
  ) {
    throw new Error(
      `No answer-sheet pages found in range ${startPage}-${endPage}.`
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

          Math.round(
            (
              (
                startPage -
                1
              ) /
              totalPages
            ) *
              100
          ),

          `Preparing answer extraction for pages ${startPage}-${endPage}.`
        ),
    }
  );

  const validQuestionNumbers =
    assessment.questions.map(
      (
        question
      ) =>
        question.number
    );

  const existingAnswers =
    assessment.answers ?? [];

  let activeQuestion:
    | string
    | undefined;

  for (
    const answer of existingAnswers
  ) {
    if (
      answer.explicitQuestionNumber
    ) {
      activeQuestion =
        answer.explicitQuestionNumber;
    } else if (
      answer.continuationOf
    ) {
      activeQuestion =
        answer.continuationOf;
    }
  }

  const pageAnswers:
    Answer[] = [];

  for (
    let index = 0;
    index <
    pages.length;
    index += 1
  ) {
    const page =
      pages[index];

    if (
      !page.imagePath
    ) {
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

    try {
      const answers =
        await extractGroqAnswersFromPage({
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

      activeQuestion =
        updateActiveQuestion(
          answers,
          activeQuestion
        );

      console.log(
        `[Answer Extraction] Page ${page.pageNumber} produced ${answers.length} answer block(s).`
      );

      console.log(
        `[Answer Extraction] Next active question: ${
          activeQuestion ??
          "NONE"
        }`
      );

      const answersOutsideRange =
        existingAnswers.filter(
          (
            answer
          ) =>
            !answer.regions.some(
              (
                region
              ) =>
                region.page >=
                  startPage &&
                region.page <=
                  endPage
            )
        );

      const rawAnswersForRange =
        [
          ...answersOutsideRange,
          ...pageAnswers,
        ];

      console.log(
        "\n========== RAW PAGE ANSWERS =========="
      );

      console.log(
        JSON.stringify(
          pageAnswers.map(
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
        "======================================\n"
      );

      const aggregatedAnswers =
        aggregateLogicalAnswers(
          rawAnswersForRange,
          assessment.questions
        );

      console.log(
        "\n========== AGGREGATED ANSWERS =========="
      );

      console.log(
        JSON.stringify(
          aggregatedAnswers.map(
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

              textPreview:
                answer.text
                  .slice(
                    0,
                    150
                  )
                  .replace(
                    /\n/g,
                    " "
                  ),
            })
          ),
          null,
          2
        )
      );

      console.log(
        "========================================\n"
      );

      /**
       * IMPORTANT:
       * Preserve ALL completed pages already stored,
       * including pages from previous chunks.
       */
      const checkpointAssessment =
        memoryStore.getById(
          assessmentId
        );

      if (
        !checkpointAssessment
      ) {
        throw new Error(
          "Assessment not found while saving page-range checkpoint."
        );
      }

      const previouslyCompleted =
        getCompletedAnswerPages(
          checkpointAssessment
        );

      const completedPages =
        [
          ...new Set([
            ...previouslyCompleted,
            ...pages
              .filter(
                (
                  candidate
                ) =>
                  candidate.pageNumber <=
                  page.pageNumber
              )
              .map(
                (
                  candidate
                ) =>
                  candidate.pageNumber
              ),
          ]),
        ].sort(
          (a, b) =>
            a - b
        );

      const nextPage =
        assessment.answerSheet.pages.find(
          (
            candidate
          ) =>
            !completedPages.includes(
              candidate.pageNumber
            )
        )?.pageNumber ??
        totalPages + 1;

      const completedTotal =
        completedPages.length;

      updateAssessment(
        assessmentId,
        {
          status:
            "extracting_answers",

          answers:
            aggregatedAnswers,

          progress:
            createProgress(
              "extracting_answers",

              Math.round(
                (
                  completedTotal /
                  totalPages
                ) *
                  100
              ),

              `Completed answer page ${page.pageNumber}/${totalPages}.`
            ),

          answerExtraction:
            createAnswerExtractionState(
              checkpointAssessment,
              nextPage,
              completedPages
            ),
        }
      );

      if (
        index <
        pages.length - 1
      ) {
        await sleep(
          2500
        );
      }
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : "Answer extraction failed.";

      const rateLimited =
        isRateLimitError(
          error
        );

      const latest =
        memoryStore.getById(
          assessmentId
        );

      if (
        latest
      ) {
        const completedBeforeFailure =
          getCompletedAnswerPages(
            latest
          );

        updateAssessment(
          assessmentId,
          {
            status:
              rateLimited
                ? "rate_limited"
                : "failed",

            progress:
              createProgress(
                rateLimited
                  ? "rate_limited"
                  : "failed",

                Math.round(
                  (
                    completedBeforeFailure.length /
                    totalPages
                  ) *
                    100
                ),

                rateLimited
                  ? `Answer extraction paused at page ${page.pageNumber}.`
                  : `Answer extraction failed on page ${page.pageNumber}.`
              ),

            answerExtraction:
              createAnswerExtractionState(
                latest,
                page.pageNumber,
                completedBeforeFailure,
                message
              ),

            error:
              message,
          }
        );
      }

      throw error;
    }
  }

  const answersOutsideRange =
    existingAnswers.filter(
      (
        answer
      ) =>
        !answer.regions.some(
          (
            region
          ) =>
            region.page >=
              startPage &&
            region.page <=
              endPage
        )
    );

  const allRawAnswers =
    [
      ...answersOutsideRange,
      ...pageAnswers,
    ];

  const aggregatedAnswers =
    aggregateLogicalAnswers(
      allRawAnswers,
      assessment.questions
    );

  console.log(
    "\n========== FINAL ANSWERS BEFORE STORAGE =========="
  );

  console.log(
    JSON.stringify(
      aggregatedAnswers.map(
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

          textPreview:
            answer.text
              .slice(
                0,
                200
              )
              .replace(
                /\n/g,
                " "
              ),
        })
      ),
      null,
      2
    )
  );

  console.log(
    "===================================================\n"
  );

  /**
   * Preserve existing completed-page checkpoint state.
   */
  const latestBeforeFinal =
    memoryStore.getById(
      assessmentId
    );

  if (
    !latestBeforeFinal
  ) {
    throw new Error(
      "Assessment not found before final answer storage."
    );
  }

  const completedPages =
    getCompletedAnswerPages(
      latestBeforeFinal
    );

  const nextPage =
    assessment.answerSheet.pages.find(
      (
        page
      ) =>
        !completedPages.includes(
          page.pageNumber
        )
    )?.pageNumber ??
    totalPages + 1;

  const allPagesComplete =
    completedPages.length >=
      totalPages &&
    completedPages.every(
      (
        page
      ) =>
        page >= 1 &&
        page <= totalPages
    );

  const updatedAssessment =
    updateAssessment(
      assessmentId,
      {
        status:
          allPagesComplete
            ? "processing"
            : "extracting_answers",

        answers:
          aggregatedAnswers,

        answerExtraction:
          createAnswerExtractionState(
            latestBeforeFinal,
            nextPage,
            completedPages
          ),

        progress:
          createProgress(
            "processing",

            Math.round(
              (
                completedPages.length /
                totalPages
              ) *
                100
            ),

            allPagesComplete
              ? `All ${totalPages} answer pages extracted and aggregated.`
              : `Extracted and aggregated answer pages ${startPage}-${endPage}.`
          ),
      }
    );

  if (
    !updatedAssessment
  ) {
    throw new Error(
      "Failed to update assessment after answer extraction."
    );
  }

  console.log(
    "\n========== STORED ANSWERS AFTER UPDATE =========="
  );

  console.log(
    JSON.stringify(
      updatedAssessment.answers.map(
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
    "==================================================\n"
  );

  return updatedAssessment;
}

/**
 * ============================================================
 * RESUME ANSWER EXTRACTION
 * ============================================================
 */

export async function resumeAnswerExtraction(
  assessmentId: string
): Promise<Assessment> {
  const assessment =
    memoryStore.getById(
      assessmentId
    );

  if (
    !assessment
  ) {
    throw new Error(
      "Assessment not found."
    );
  }

  if (
    assessment.questions.length ===
    0
  ) {
    throw new Error(
      "Questions must be extracted before answers."
    );
  }

  const totalPages =
    assessment.answerSheet.pageCount;

  const completedPages =
    getCompletedAnswerPages(
      assessment
    );

  const nextPage =
    assessment.answerExtraction
      ?.nextPage ??
    (
      assessment.answerSheet.pages.find(
        (
          page
        ) =>
          !completedPages.includes(
            page.pageNumber
          )
      )?.pageNumber ??
      totalPages + 1
    );

  if (
    nextPage >
    totalPages
  ) {
    const updated =
      updateAssessment(
        assessmentId,
        {
          status:
            "processing",

          answerExtraction: {
            completedPages,

            nextPage:
              totalPages + 1,

            totalPages,

            lastCompletedPage:
              completedPages.length > 0
                ? completedPages[
                    completedPages.length -
                      1
                  ]
                : undefined,

            lastError:
              undefined,

            updatedAt:
              new Date().toISOString(),
          },

          progress:
            createProgress(
              "processing",
              65,
              `All ${totalPages} answer pages are already complete.`
            ),

          error:
            undefined,
        }
      );

    if (
      !updated
    ) {
      throw new Error(
        "Assessment could not be updated."
      );
    }

    return updated;
  }

  updateAssessment(
    assessmentId,
    {
      status:
        "extracting_answers",

      progress:
        createProgress(
          "extracting_answers",

          Math.round(
            (
              completedPages.length /
              totalPages
            ) *
              100
          ),

          `Resuming answer extraction from page ${nextPage}.`
        ),

      error:
        undefined,
    }
  );

  const latest =
    memoryStore.getById(
      assessmentId
    );

  if (
    !latest
  ) {
    throw new Error(
      "Assessment not found while resuming."
    );
  }

  await extractAllAnswers(
    latest
  );

  const updatedAssessment =
    memoryStore.getById(
      assessmentId
    );

  if (
    !updatedAssessment
  ) {
    throw new Error(
      "Assessment disappeared while resuming answer extraction."
    );
  }

  return updatedAssessment;
}

/**
 * ============================================================
 * COMPATIBILITY WRAPPER
 * ============================================================
 */

export async function extractAndAggregateAnswers(
  assessment: Assessment
): Promise<Answer[]> {
  return extractAllAnswers(
    assessment
  );
}

/**
 * ============================================================
 * VALIDATION HELPERS
 * ============================================================
 */

export function hasQuestions(
  assessment: Assessment
): boolean {
  return (
    assessment.questions.length >
    0
  );
}

export function hasAnswers(
  assessment: Assessment
): boolean {
  return (
    assessment.answers.length >
    0
  );
}