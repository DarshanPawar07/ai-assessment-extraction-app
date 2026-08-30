import { gemini, GEMINI_MODEL } from "./client";

import {
  ANSWER_MAPPING_PROMPT,
} from "./prompts/answer-mapping.prompt";

import { Answer } from "../types/answer";
import { Question } from "../types/question";
import {
  AnswerMapping,
  MappingStatus,
  MappingMatchType,
} from "../types/mapping";

/**
 * ============================================================
 * TYPES
 * ============================================================
 */

export interface AnswerMappingResult {
  mappings: AnswerMapping[];
}

export interface AnswerMapperOptions {
  questions: Question[];
  answers: Answer[];
}

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

function compactText(
  value: string
): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeQuestionReference(
  value?: string | null
): string | undefined {
  if (!value) {
    return undefined;
  }

  const cleaned =
    value
      .trim()
      .replace(/\s+/g, "")
      .replace(/^Question/i, "")
      .replace(/^Q\.?/i, "");

  const subPartMatch =
    cleaned.match(
      /^(\d+)[.)-]?\(([a-zA-Z0-9]+)\)$/
    );

  if (subPartMatch) {
    return `${subPartMatch[1]}(${subPartMatch[2].toLowerCase()})`;
  }

  const numberMatch =
    cleaned.match(
      /^(\d+)[.)-]?$/
    );

  if (numberMatch) {
    return numberMatch[1];
  }

  return cleaned.toLowerCase();
}

function createQuestionMap(
  questions: Question[]
): Map<string, Question> {
  const result =
    new Map<string, Question>();

  for (
    const question of questions
  ) {
    result.set(
      question.id,
      question
    );

    const normalized =
      normalizeQuestionReference(
        question.number
      );

    if (normalized) {
      result.set(
        normalized,
        question
      );
    }
  }

  return result;
}

function buildQuestionContext(
  questions: Question[]
) {
  return questions.map(
    (question) => ({
      id: question.id,

      number: question.number,

      text: compactText(
        question.text
      ),

      maxMarks:
        question.maxMarks,

      page:
        question.page,

      order:
        question.order,
    })
  );
}

function buildAnswerContext(
  answers: Answer[]
) {
  return answers.map(
    (answer) => ({
      id: answer.id,

      text: compactText(
        answer.text
      ),

      studentQuestionNumber:
        answer.studentQuestionNumber ??
        null,

      explicitQuestionNumber:
        answer.explicitQuestionNumber ??
        null,

      continuationOf:
        answer.continuationOf ??
        null,

      order:
        answer.order,

      regions:
        answer.regions.map(
          (region) => ({
            page:
              region.page,

            bbox:
              region.bbox,
          })
        ),

      extractionConfidence:
        answer.extractionConfidence ??
        null,
    })
  );
}

/**
 * ============================================================
 * MAIN MAPPING FUNCTION
 * ============================================================
 */

export async function mapAnswersToQuestions(
  options: AnswerMapperOptions
): Promise<AnswerMappingResult> {
  const {
    questions,
    answers,
  } = options;

  if (
    questions.length === 0
  ) {
    throw new Error(
      "Cannot map answers because no questions were provided."
    );
  }

  /**
   * No extracted answers means all questions
   * are unanswered.
   */
  if (
    answers.length === 0
  ) {
    return {
      mappings:
        questions.map(
          (
            question,
            index
          ): AnswerMapping => ({
            id:
              `mapping-${index + 1}`,

            questionId:
              question.id,

            questionNumber:
              question.number,

            answerId:
              null,

            status:
              "unanswered",

            matchType:
              "unmatched",

            confidence:
              1,

            reason:
              "No answers were extracted from the answer sheet.",

            candidateQuestionIds:
              [],
          })
        ),
    };
  }

  const questionContext =
    buildQuestionContext(
      questions
    );

  const answerContext =
    buildAnswerContext(
      answers
    );

  const prompt = `
${ANSWER_MAPPING_PROMPT}

==================================================
QUESTION PAPER DATA
==================================================

${JSON.stringify(
  questionContext,
  null,
  2
)}

==================================================
ANSWER SHEET DATA
==================================================

${JSON.stringify(
  answerContext,
  null,
  2
)}

==================================================
FINAL TASK
==================================================

Map every answer to the most appropriate canonical
question.

Remember:

The question paper numbering is authoritative.

The answer sheet numbering is only evidence.

Use answer text/question text similarity when numbering
differs.

Every question must appear at least once.

Every meaningful answer must appear in the result.

Return JSON only.
`;

  /**
   * ==========================================================
   * GEMINI REQUEST
   * ==========================================================
   */

  const response =
    await gemini.models.generateContent({
      model:
        GEMINI_MODEL,

      contents: [
        {
          role: "user",

          parts: [
            {
              text:
                prompt,
            },
          ],
        },
      ],

      config: {
        responseMimeType:
          "application/json",
      },
    });

  const responseText =
    response.text;

  if (!responseText) {
    throw new Error(
      "Gemini returned an empty response during answer mapping."
    );
  }

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(
        responseText
      );
  } catch {
    console.error(
      "Invalid JSON returned during answer mapping:"
    );

    console.error(
      responseText
    );

    throw new Error(
      "Gemini returned invalid JSON during answer mapping."
    );
  }

  const normalizedResponse =
    Array.isArray(parsed)
      ? {
          mappings:
            parsed,
        }
      : parsed;

  if (
    typeof normalizedResponse !==
      "object" ||
    normalizedResponse === null
  ) {
    throw new Error(
      "Invalid answer-mapping response."
    );
  }

  const rawMappings =
    (
      normalizedResponse as {
        mappings?: unknown;
      }
    ).mappings;

  if (
    !Array.isArray(
      rawMappings
    )
  ) {
    throw new Error(
      "Answer-mapping response does not contain a mappings array."
    );
  }

  /**
   * ==========================================================
   * LOOKUPS
   * ==========================================================
   */

  const questionsById =
    new Map(
      questions.map(
        (question) => [
          question.id,
          question,
        ]
      )
    );

  const answersById =
    new Map(
      answers.map(
        (answer) => [
          answer.id,
          answer,
        ]
      )
    );

  const questionMap =
    createQuestionMap(
      questions
    );

  const assignedQuestionIds =
    new Set<string>();

  const assignedAnswerIds =
    new Set<string>();

  const mappings:
    AnswerMapping[] = [];

  /**
   * ==========================================================
   * NORMALIZE AI MAPPINGS
   * ==========================================================
   */

  for (
    let index = 0;
    index < rawMappings.length;
    index += 1
  ) {
    const rawMapping =
      rawMappings[index];

    if (
      typeof rawMapping !==
        "object" ||
      rawMapping === null
    ) {
      continue;
    }

    const item =
      rawMapping as {
        questionId?: unknown;
        questionNumber?: unknown;
        answerId?: unknown;
        status?: unknown;
        matchType?: unknown;
        confidence?: unknown;
        reason?: unknown;
        candidateQuestionIds?: unknown;
      };

    const rawQuestionId =
      typeof item.questionId ===
      "string"
        ? item.questionId
        : null;

    const rawQuestionNumber =
      typeof item.questionNumber ===
      "string"
        ? item.questionNumber
        : null;

    const rawAnswerId =
      typeof item.answerId ===
      "string"
        ? item.answerId
        : null;

    /**
     * Resolve question.
     */
    let question:
      | Question
      | undefined;

    if (
      rawQuestionId
    ) {
      question =
        questionsById.get(
          rawQuestionId
        );
    }

    if (
      !question &&
      rawQuestionNumber
    ) {
      const normalized =
        normalizeQuestionReference(
          rawQuestionNumber
        );

      if (normalized) {
        question =
          questionMap.get(
            normalized
          );
      }
    }

    /**
     * Resolve answer.
     */
    const answer =
      rawAnswerId
        ? answersById.get(
            rawAnswerId
          )
        : undefined;

    /**
     * Validate status.
     */
    let status:
      MappingStatus =
      "ambiguous";

    if (
      item.status ===
        "matched" ||
      item.status ===
        "unanswered" ||
      item.status ===
        "ambiguous" ||
      item.status ===
        "unmatched"
    ) {
      status =
        item.status;
    }

    /**
     * Validate match type.
     */
    let matchType:
      MappingMatchType =
      "ambiguous";

    if (
      item.matchType ===
        "exact_label" ||
      item.matchType ===
        "label_and_semantic" ||
      item.matchType ===
        "semantic" ||
      item.matchType ===
        "contextual" ||
      item.matchType ===
        "ambiguous" ||
      item.matchType ===
        "unmatched"
    ) {
      matchType =
        item.matchType;
    }

    /**
     * Confidence.
     */
    let confidence =
      typeof item.confidence ===
      "number"
        ? item.confidence
        : 0;

    confidence =
      Math.max(
        0,
        Math.min(
          1,
          confidence
        )
      );

    /**
     * Reason.
     */
    const reason =
      typeof item.reason ===
      "string"
        ? item.reason
        : "No mapping reason provided.";

    /**
     * Candidate questions.
     */
    const candidateQuestionIds =
      Array.isArray(
        item.candidateQuestionIds
      )
        ? item.candidateQuestionIds
            .filter(
              (
                value
              ): value is string =>
                typeof value ===
                "string"
            )
            .filter(
              (
                id
              ) =>
                questionsById.has(
                  id
                )
            )
        : [];

    /**
     * --------------------------------------------------------
     * Invalid match
     * --------------------------------------------------------
     */

    if (
      status ===
        "matched" &&
      (!question ||
        !answer)
    ) {
      status =
        "unmatched";

      matchType =
        "unmatched";

      confidence =
        Math.min(
          confidence,
          0.3
        );
    }

    /**
     * --------------------------------------------------------
     * Duplicate question
     * --------------------------------------------------------
     */

    if (
      status ===
        "matched" &&
      question &&
      assignedQuestionIds.has(
        question.id
      )
    ) {
      status =
        "ambiguous";

      matchType =
        "ambiguous";

      confidence =
        Math.min(
          confidence,
          0.5
        );
    }

    /**
     * --------------------------------------------------------
     * Duplicate answer
     * --------------------------------------------------------
     */

    if (
      status ===
        "matched" &&
      answer &&
      assignedAnswerIds.has(
        answer.id
      )
    ) {
      status =
        "ambiguous";

      matchType =
        "ambiguous";

      confidence =
        Math.min(
          confidence,
          0.5
        );
    }

    /**
     * Register successful mapping.
     */
    if (
      status ===
        "matched" &&
      question &&
      answer
    ) {
      assignedQuestionIds.add(
        question.id
      );

      assignedAnswerIds.add(
        answer.id
      );
    }

    mappings.push({
      id:
        `mapping-${index + 1}`,

      questionId:
        question?.id ??
        null,

      questionNumber:
        question?.number ??
        rawQuestionNumber ??
        null,

      answerId:
        answer?.id ??
        rawAnswerId ??
        null,

      status,

      matchType,

      confidence,

      reason,

      candidateQuestionIds,
    });
  }

  /**
   * ==========================================================
   * GUARANTEE EVERY QUESTION
   * ==========================================================
   */

  for (
    const question of questions
  ) {
    const alreadyMapped =
      mappings.some(
        (mapping) =>
          mapping.questionId ===
          question.id
      );

    if (
      alreadyMapped
    ) {
      continue;
    }

    mappings.push({
      id:
        `mapping-question-${question.id}`,

      questionId:
        question.id,

      questionNumber:
        question.number,

      answerId:
        null,

      status:
        "unanswered",

      matchType:
        "unmatched",

      confidence:
        1,

      reason:
        "No extracted answer was confidently mapped to this question.",

      candidateQuestionIds:
        [],
    });
  }

  /**
   * ==========================================================
   * GUARANTEE EVERY ANSWER
   * ==========================================================
   */

  for (
    const answer of answers
  ) {
    const alreadyMapped =
      mappings.some(
        (mapping) =>
          mapping.answerId ===
          answer.id
      );

    if (
      alreadyMapped
    ) {
      continue;
    }

    mappings.push({
      id:
        `mapping-answer-${answer.id}`,

      questionId:
        null,

      questionNumber:
        null,

      answerId:
        answer.id,

      status:
        "unmatched",

      matchType:
        "unmatched",

      confidence:
        Math.max(
          0,
          Math.min(
            1,
            1 -
              (
                answer.extractionConfidence ??
                0
              )
          )
        ),

      reason:
        "This extracted answer could not be confidently assigned to a question.",

      candidateQuestionIds:
        [],
    });
  }

  /**
   * ==========================================================
   * FINAL SORT
   * ==========================================================
   */

  const questionOrder =
    new Map<string, number>();

  for (
    const question of questions
  ) {
    questionOrder.set(
      question.id,
      question.order
    );
  }

  mappings.sort(
    (a, b) => {
      if (
        a.questionId &&
        b.questionId
      ) {
        return (
          (
            questionOrder.get(
              a.questionId
            ) ??
            Number.MAX_SAFE_INTEGER
          ) -
          (
            questionOrder.get(
              b.questionId
            ) ??
            Number.MAX_SAFE_INTEGER
          )
        );
      }

      if (
        a.questionId
      ) {
        return -1;
      }

      if (
        b.questionId
      ) {
        return 1;
      }

      return 0;
    }
  );

  return {
    mappings,
  };
}