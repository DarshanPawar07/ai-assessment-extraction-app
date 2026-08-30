import fs from "fs/promises";

import { gemini, GEMINI_MODEL } from "./client";
import {
  ANSWER_EXTRACTION_PROMPT,
} from "./prompts/answer-extraction.prompt";

import { Answer } from "../types/answer";

import {
  answerExtractionResultSchema,
} from "../schemas/answer.schema";

import {
  clampBoundingBox,
} from "../document/coordinate-utils";

/**
 * ============================================================
 * INPUT TYPES
 * ============================================================
 */

export interface ExtractAnswersOptions {
  imagePath: string;
  pageNumber: number;
  imageWidth: number;
  imageHeight: number;

  validQuestionNumbers: string[];

  previousActiveQuestionNumber?: string;
}

/**
 * ============================================================
 * QUESTION REFERENCE NORMALIZATION
 * ============================================================
 */

function normalizeQuestionReference(
  value?: string | null
): string | undefined {
  if (!value) {
    return undefined;
  }

  let cleaned =
    value
      .trim()
      .replace(/\s+/g, "")
      .replace(/^Question/i, "")
      .replace(/^Q\.?/i, "");

  cleaned =
    cleaned.replace(
      /[,;:]$/,
      ""
    );

  /**
   * Nested:
   * 1(a)(i)
   * 1(b)(ii)
   */
  const nestedMatch =
    cleaned.match(
      /^(\d+)(?:[.)-])?\(([a-zA-Z0-9]+)\)(?:[.)-])?\(([a-zA-Z0-9]+)\)$/
    );

  if (nestedMatch) {
    return `${nestedMatch[1]}(${nestedMatch[2]})(${nestedMatch[3]})`;
  }

  /**
   * Standard:
   * 1(a)
   * 1-a
   * 1 a
   */
  const subPartMatch =
    cleaned.match(
      /^(\d+)(?:[.)-])?(?:\(([a-zA-Z0-9]+)\)|[ -]?([a-zA-Z0-9]))[.)]?$/
    );

  if (subPartMatch) {
    const part =
      subPartMatch[2] ??
      subPartMatch[3];

    if (part) {
      return `${subPartMatch[1]}(${part})`;
    }
  }

  /**
   * Standalone:
   * 1
   * 1.
   * 1)
   */
  const numberMatch =
    cleaned.match(
      /^(\d+)[.)-]?$/
    );

  if (numberMatch) {
    return numberMatch[1];
  }

  return undefined;
}

/**
 * ============================================================
 * VALID QUESTION NUMBERS
 * ============================================================
 */

function normalizeValidQuestionNumbers(
  questionNumbers: string[]
): Set<string> {
  const result =
    new Set<string>();

  for (
    const questionNumber of questionNumbers
  ) {
    const normalized =
      normalizeQuestionReference(
        questionNumber
      );

    if (normalized) {
      result.add(normalized);
    }
  }

  return result;
}

/**
 * ============================================================
 * QUESTION CONTEXT HELPERS
 * ============================================================
 */

function getTopLevelQuestionNumber(
  questionNumber?: string
): string | undefined {
  if (!questionNumber) {
    return undefined;
  }

  const match =
    questionNumber.match(
      /^(\d+)/
    );

  return match?.[1];
}

/**
 * Find short sub-part labels such as:
 *
 * a)
 * b)
 * c)
 */
function getLeadingSubPart(
  text: string
): string | undefined {
  const match =
    text.match(
      /^\s*([a-zA-Z])\s*\)/
    );

  return match?.[1]?.toLowerCase();
}

/**
 * Infer a canonical question from a short
 * sub-part label.
 *
 * Example:
 *
 * active question = 1(b)
 * text starts = c)
 * valid question = 1(c)
 *
 * result = 1(c)
 */
function inferSubPartFromText(
  text: string,
  activeQuestion: string | undefined,
  validQuestionNumbers: Set<string>
): string | undefined {
  const part =
    getLeadingSubPart(
      text
    );

  if (!part) {
    return undefined;
  }

  const topLevel =
    getTopLevelQuestionNumber(
      activeQuestion
    );

  if (!topLevel) {
    return undefined;
  }

  const candidate =
    `${topLevel}(${part})`;

  if (
    validQuestionNumbers.has(
      candidate
    )
  ) {
    return candidate;
  }

  return undefined;
}

/**
 * ============================================================
 * TEXT CLEANUP
 * ============================================================
 */

function cleanAnswerText(
  text: string
): string {
  let cleaned =
    text.trim();

  const metadataPatterns = [
    /^\s*\(SPPU.*?\)\s*$/gim,

    /^\s*\[\s*\d+\s*marks?\s*\]\s*$/gim,

    /^\s*SPPU\s+ENDSEM.*$/gim,
  ];

  for (
    const pattern of metadataPatterns
  ) {
    cleaned =
      cleaned.replace(
        pattern,
        ""
      );
  }

  return cleaned
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
}

/**
 * ============================================================
 * ANSWER ID
 * ============================================================
 */

function createAnswerId(
  pageNumber: number,
  index: number
): string {
  return `ans-page-${pageNumber}-${index}`;
}

/**
 * ============================================================
 * MAIN FUNCTION
 * ============================================================
 */

export async function extractAnswersFromPage(
  options: ExtractAnswersOptions
): Promise<Answer[]> {
  const {
    imagePath,
    pageNumber,
    imageWidth,
    imageHeight,
    validQuestionNumbers: rawValidQuestionNumbers,
    previousActiveQuestionNumber,
  } = options;

  /**
   * Read image.
   */
  const imageBuffer =
    await fs.readFile(
      imagePath
    );

  const base64Image =
    imageBuffer.toString(
      "base64"
    );

  /**
   * Normalize valid question identifiers.
   */
  const validQuestionNumbers =
    normalizeValidQuestionNumbers(
      rawValidQuestionNumbers
    );

  const validQuestionText =
    Array.from(
      validQuestionNumbers
    ).join(", ");

  /**
   * Previous active question.
   */
  const previousActiveQuestion =
    normalizeQuestionReference(
      previousActiveQuestionNumber
    );

  /**
   * ==========================================================
   * PROMPT
   * ==========================================================
   */

  const prompt = `
${ANSWER_EXTRACTION_PROMPT}

PAGE NUMBER:
${pageNumber}

IMAGE WIDTH:
${imageWidth}

IMAGE HEIGHT:
${imageHeight}

VALID QUESTION NUMBERS:
${validQuestionText || "NONE"}

PREVIOUS ACTIVE QUESTION:
${previousActiveQuestion ?? "NONE"}

IMPORTANT:

Extract answer blocks from THIS PAGE ONLY.

Preserve the original question label visible on
the answer sheet in:

studentQuestionNumber

Examples:

Q.1(a)
1(a)
b)
3)

Do not silently replace the student's original label.

If the label can confidently be mapped to one of the
valid question-paper identifiers, also provide:

explicitQuestionNumber

For example:

studentQuestionNumber = "3)"
explicitQuestionNumber = "1(c)"

If it cannot be confidently resolved:

explicitQuestionNumber = null

If this page continues the previous answer:

continuationOf = "${
    previousActiveQuestion ?? ""
  }"

Internal numbering such as:

1)
2)
3)

or:

i)
ii)
iii)

does NOT automatically represent new exam questions.

Every answer region must:
- belong to page ${pageNumber}
- remain within ${imageWidth} x ${imageHeight}
- tightly cover the actual answer content
- exclude unrelated content
- exclude large blank areas

Return ONLY JSON:

{
  "answers": [
    {
      "id": "answer-0",
      "text": "answer text",
      "studentQuestionNumber": "1(a)",
      "explicitQuestionNumber": "1(a)",
      "continuationOf": null,
      "regions": [
        {
          "page": ${pageNumber},
          "bbox": {
            "x": 100,
            "y": 150,
            "width": 500,
            "height": 300
          }
        }
      ],
      "order": 0,
      "extractionConfidence": 0.95
    }
  ]
}

If no answer content exists:

{
  "answers": []
}
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
              text: prompt,
            },

            {
              inlineData: {
                mimeType:
                  "image/png",

                data:
                  base64Image,
              },
            },
          ],
        },
      ],

      config: {
        responseMimeType:
          "application/json",
      },
    });

  /**
   * ==========================================================
   * RESPONSE
   * ==========================================================
   */

  const responseText =
    response.text;

  if (!responseText) {
    throw new Error(
      `Gemini returned an empty response for answer page ${pageNumber}.`
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
      `Invalid JSON returned by Gemini for page ${pageNumber}:`
    );

    console.error(
      responseText
    );

    throw new Error(
      `Gemini returned invalid JSON for answer page ${pageNumber}.`
    );
  }

  /**
   * Gemini can occasionally return a bare array.
   * Normalize it.
   */
  const normalizedResponse =
    Array.isArray(parsed)
      ? {
          answers: parsed,
        }
      : parsed;

  /**
   * ==========================================================
   * SCHEMA VALIDATION
   * ==========================================================
   */

  const validationResult =
    answerExtractionResultSchema.safeParse(
      normalizedResponse
    );

  if (!validationResult.success) {
    console.error(
      `Invalid answer extraction response for page ${pageNumber}:`
    );

    console.error(
      validationResult.error.flatten()
    );

    console.error(
      "Normalized response:"
    );

    console.error(
      JSON.stringify(
        normalizedResponse,
        null,
        2
      )
    );

    throw new Error(
      `Gemini answer response failed schema validation on page ${pageNumber}.`
    );
  }

  /**
   * ==========================================================
   * NORMALIZE INTO APPLICATION Answer[]
   * ==========================================================
   *
   * IMPORTANT:
   *
   * We DO NOT use:
   *
   * ...answer
   *
   * here.
   *
   * This prevents nullable Zod values from leaking
   * into the application-level Answer type.
   */

  const normalizedAnswers: Answer[] = [];

  for (
    let index = 0;
    index <
    validationResult.data.answers.length;
    index += 1
  ) {
    const answer =
      validationResult.data.answers[
        index
      ];

    /**
     * --------------------------------------------------------
     * Student's original label
     * --------------------------------------------------------
     */

    const studentQuestionNumber:
      | string
      | undefined =
      typeof answer.studentQuestionNumber ===
      "string"
        ? answer.studentQuestionNumber.trim()
        : undefined;

    /**
     * --------------------------------------------------------
     * Model explicit question
     * --------------------------------------------------------
     */

    const modelExplicit =
      normalizeQuestionReference(
        typeof answer.explicitQuestionNumber ===
          "string"
          ? answer.explicitQuestionNumber
          : undefined
      );

    /**
     * --------------------------------------------------------
     * Model continuation
     * --------------------------------------------------------
     */

    const modelContinuation =
      normalizeQuestionReference(
        typeof answer.continuationOf ===
          "string"
          ? answer.continuationOf
          : undefined
      );

    /**
     * --------------------------------------------------------
     * Infer short sub-part if possible.
     * --------------------------------------------------------
     */

    const inferredQuestion =
      inferSubPartFromText(
        answer.text,
        previousActiveQuestion,
        validQuestionNumbers
      );

    /**
     * --------------------------------------------------------
     * Validate model explicit question.
     * --------------------------------------------------------
     */

    const safeExplicitQuestion =
      modelExplicit &&
      validQuestionNumbers.has(
        modelExplicit
      )
        ? modelExplicit
        : undefined;

    /**
     * Use inference only if the model's
     * explicit identifier is invalid/missing.
     */
    const finalExplicitQuestion =
      safeExplicitQuestion ??
      inferredQuestion;

    /**
     * --------------------------------------------------------
     * Validate continuation.
     * --------------------------------------------------------
     */

    const safeContinuation =
      modelContinuation &&
      validQuestionNumbers.has(
        modelContinuation
      )
        ? modelContinuation
        : undefined;

    let finalContinuation:
      | string
      | undefined =
      safeContinuation;

    /**
     * New question has priority over continuation.
     */
    if (
      finalExplicitQuestion
    ) {
      finalContinuation =
        undefined;
    } else if (
      !finalContinuation &&
      previousActiveQuestion
    ) {
      finalContinuation =
        previousActiveQuestion;
    }

    /**
     * --------------------------------------------------------
     * SAFE REGIONS
     * --------------------------------------------------------
     */

    const safeRegions:
      {
        page: number;

        bbox: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      }[] = [];

    for (
      const region of answer.regions
    ) {
      /**
       * Only accept regions that belong
       * to the current page.
       */
      if (
        region.page !==
        pageNumber
      ) {
        continue;
      }

      const bbox =
        clampBoundingBox(
          region.bbox,
          imageWidth,
          imageHeight
        );

      safeRegions.push({
        page:
          pageNumber,

        bbox,
      });
    }

    if (
      safeRegions.length === 0
    ) {
      throw new Error(
        `Gemini returned no valid region for answer ${index} on page ${pageNumber}.`
      );
    }

    /**
     * --------------------------------------------------------
     * CONFIDENCE
     * --------------------------------------------------------
     */

    const extractionConfidence:
      | number
      | undefined =
      typeof answer.extractionConfidence ===
      "number"
        ? Math.max(
            0,
            Math.min(
              1,
              answer.extractionConfidence
            )
          )
        : undefined;

    /**
     * --------------------------------------------------------
     * FINAL APPLICATION ANSWER
     * --------------------------------------------------------
     */

    const normalizedAnswer: Answer = {
      id:
        createAnswerId(
          pageNumber,
          index
        ),

      text:
        cleanAnswerText(
          answer.text
        ),

      /**
       * null has already been converted
       * to undefined.
       */
      studentQuestionNumber:
        studentQuestionNumber,

      explicitQuestionNumber:
        finalExplicitQuestion,

      continuationOf:
        finalExplicitQuestion
          ? undefined
          : finalContinuation,

      regions:
        safeRegions,

      order:
        index,

      extractionConfidence:
        extractionConfidence,
    };

    normalizedAnswers.push(
      normalizedAnswer
    );
  }

  return normalizedAnswers;
}