import fs from "fs/promises";

import { groq, GROQ_MODEL } from "./client";
import {
  GROQ_ANSWER_EXTRACTION_PROMPT,
} from "./prompts/answer-extraction.prompt";
import {
  withGroqRetry,
} from "./rate-limit";

import { Answer } from "../../types/answer";

import {
  answerExtractionResultSchema,
} from "../../schemas/answer.schema";

import {
  clampBoundingBox,
} from "../../document/coordinate-utils";

/**
 * ============================================================
 * INPUT TYPES
 * ============================================================
 */

export interface GroqAnswerPageInput {
  imagePath: string;
  pageNumber: number;
  imageWidth: number;
  imageHeight: number;
}

export interface GroqAnswerExtractionOptions {
  page: GroqAnswerPageInput;

  /**
   * Canonical question identifiers extracted from
   * the actual question paper.
   *
   * Example:
   *
   * [
   *   "1(a)",
   *   "1(b)",
   *   "1(c)",
   *   "2(a)",
   *   "2(b)"
   * ]
   */
  validQuestionNumbers: string[];

  /**
   * Canonical question active on the previous page.
   *
   * Example:
   *
   * "1(a)"
   */
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
   *
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
   *
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
   *
   * 1
   * 1.
   * 1)
   *
   * IMPORTANT:
   * We normalize this only for comparison.
   * We do NOT use a standalone number to invent
   * a canonical question mapping.
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
    const questionNumber of
      questionNumbers
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
 * TEXT CLEANUP
 * ============================================================
 */

/**
 * Remove common printed metadata from answer text.
 *
 * This is deliberately conservative so that actual
 * answer content is not accidentally removed.
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
    const pattern of
      metadataPatterns
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
 * MAIN EXTRACTION FUNCTION
 * ============================================================
 */

export async function extractAnswersFromPage(
  options: GroqAnswerExtractionOptions
): Promise<Answer[]> {
  const {
    page,
    validQuestionNumbers:
      rawValidQuestionNumbers,
    previousActiveQuestionNumber,
  } = options;

  /**
   * ----------------------------------------------------------
   * Read page image
   * ----------------------------------------------------------
   */

  const imageBuffer =
    await fs.readFile(
      page.imagePath
    );

  const base64Image =
    imageBuffer.toString(
      "base64"
    );

  /**
   * ----------------------------------------------------------
   * Normalize canonical question list
   * ----------------------------------------------------------
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
   * ----------------------------------------------------------
   * Normalize previous active question
   * ----------------------------------------------------------
   */

  const previousActiveQuestion =
    normalizeQuestionReference(
      previousActiveQuestionNumber
    );

  /**
   * ----------------------------------------------------------
   * Prompt
   * ----------------------------------------------------------
   */

  const prompt = `
${GROQ_ANSWER_EXTRACTION_PROMPT}

==================================================
CURRENT PAGE
==================================================

PAGE NUMBER:
${page.pageNumber}

IMAGE WIDTH:
${page.imageWidth}

IMAGE HEIGHT:
${page.imageHeight}

==================================================
VALID QUESTION NUMBERS
==================================================

${validQuestionText || "NONE"}

==================================================
PREVIOUS ACTIVE QUESTION
==================================================

${previousActiveQuestion ?? "NONE"}

==================================================
IMPORTANT EXTRACTION RULE
==================================================

This stage is EXTRACTION, not final question mapping.

Preserve what is actually written on the answer sheet.

The answer sheet label must be stored as:

studentQuestionNumber

Examples:

Q.1(a) -> "Q.1(a)"
1(a)   -> "1(a)"
b)     -> "b)"
3)     -> "3)"

Do NOT convert an ambiguous label such as "3)" into
"1(c)" merely because it seems likely.

The canonical question mapping will happen later using
question text and semantic matching.

Therefore:

If the page visibly starts with:

3) Explain effective modular design with neat diagram.

return:

"studentQuestionNumber": "3)"

and normally:

"explicitQuestionNumber": null

unless the canonical question is unmistakably visible
or explicitly established by the page itself.

==================================================
CONTINUATION
==================================================

If this page continues the previous active answer and
does not visibly begin a new answer, use:

"continuationOf": "${
    previousActiveQuestion ?? ""
  }"

Do not create a new question just because the answer
contains internal numbering.

For example:

2) Data abstraction
3) Modularity

can be internal content of 1(a).

==================================================
BOUNDING BOX
==================================================

Every answer block must have one region for this page.

The box should tightly contain the actual visible answer
content.

Include:
- answer text
- question label when it belongs to the answer
- diagrams belonging to that answer
- formulas belonging to that answer

Exclude:
- large blank margins
- unrelated answers
- unrelated printed metadata
- blank areas

Coordinates are PIXELS.

Origin:
(0,0) = top-left.

All boxes MUST remain inside:

width  = ${page.imageWidth}
height = ${page.imageHeight}

==================================================
OUTPUT
==================================================

Return ONLY JSON.

Use exactly:

{
  "answers": [
    {
      "id": "answer-0",
      "text": "answer text",
      "studentQuestionNumber": "3)",
      "explicitQuestionNumber": null,
      "continuationOf": null,
      "regions": [
        {
          "page": ${page.pageNumber},
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

For a continuation:

{
  "answers": [
    {
      "id": "answer-0",
      "text": "continuation text",
      "studentQuestionNumber": null,
      "explicitQuestionNumber": null,
      "continuationOf": "${
        previousActiveQuestion ?? ""
      }",
      "regions": [
        {
          "page": ${page.pageNumber},
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

If there is no answer content:

{
  "answers": []
}

Return JSON only.
Do not return Markdown.
Do not return explanations.
`;

  /**
   * ==========================================================
   * GROQ REQUEST
   * ==========================================================
   */

  const completion =
    await withGroqRetry(
      () =>
        groq.chat.completions.create(
          {
            model:
              GROQ_MODEL,

            messages: [
              {
                role: "user",

                content: [
                  {
                    type: "text",
                    text: prompt,
                  },

                  {
                    type: "image_url",

                    image_url: {
                      url:
                        `data:image/png;base64,${base64Image}`,
                    },
                  },
                ],
              },
            ],

            temperature:
              0.1,

            max_completion_tokens:
              3000,

            response_format: {
              type: "json_object",
            },

            reasoning_effort:
              "none",
          }
        )
    );

  /**
   * ==========================================================
   * RESPONSE TEXT
   * ==========================================================
   */

  const responseText =
    completion
      .choices[0]
      ?.message
      ?.content;

  if (!responseText) {
    throw new Error(
      `Groq returned an empty response for answer page ${page.pageNumber}.`
    );
  }

  /**
   * ==========================================================
   * PARSE JSON
   * ==========================================================
   */

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(
        responseText
      );
  } catch {
    console.error(
      "Invalid JSON returned by Groq:"
    );

    console.error(
      responseText
    );

    throw new Error(
      `Groq returned invalid JSON for answer page ${page.pageNumber}.`
    );
  }

  /**
   * ==========================================================
   * NORMALIZE ARRAY RESPONSE
   * ==========================================================
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
      `Groq answer schema validation failed for page ${page.pageNumber}:`
    );

    console.error(
      validationResult.error.flatten()
    );

    console.error(
      "Groq response:"
    );

    console.error(
      JSON.stringify(
        normalizedResponse,
        null,
        2
      )
    );

    throw new Error(
      `Groq answer response failed schema validation for page ${page.pageNumber}.`
    );
  }

  /**
   * ==========================================================
   * NORMALIZE ANSWERS
   * ==========================================================
   *
   * IMPORTANT:
   *
   * We explicitly create Answer objects instead of
   * spreading the Zod objects. This converts nullable
   * fields into undefined and keeps the TypeScript
   * application type strict.
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
     * Student label
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
     * Model's explicit canonical question
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
     * Model's continuation
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
     * IMPORTANT:
     *
     * Do NOT infer a canonical question from arbitrary
     * text such as "3)".
     *
     * The answer mapper will handle that later.
     * --------------------------------------------------------
     */

    const safeExplicitQuestion =
      modelExplicit &&
      validQuestionNumbers.has(
        modelExplicit
      )
        ? modelExplicit
        : undefined;

    const safeContinuation =
      modelContinuation &&
      validQuestionNumbers.has(
        modelContinuation
      )
        ? modelContinuation
        : undefined;

    /**
     * --------------------------------------------------------
     * Continuation fallback
     * --------------------------------------------------------
     *
     * Only use the previous active question when there
     * is no explicit canonical question.
     */

   let finalContinuation:
  | string
  | undefined =
  safeContinuation;

/**
 * If a valid explicit canonical question was detected,
 * this is definitely a new answer.
 */
if (
  safeExplicitQuestion
) {
  finalContinuation =
    undefined;
} else if (
  !safeContinuation &&
  previousActiveQuestion
) {
  /**
   * IMPORTANT:
   *
   * If the answer sheet visibly starts with a student
   * question label such as:
   *
   * 3)
   * b)
   * c)
   * 1(a)
   *
   * then this is likely a NEW answer block, even if we
   * cannot yet determine its canonical question-paper ID.
   *
   * Do not incorrectly classify it as a continuation.
   */
  const hasLeadingQuestionLabel =
    /^\s*(?:Q\.?\s*)?\d+\s*[.)]/i.test(
      answer.text
    ) ||
    /^\s*(?:[a-zA-Z])\s*\)/.test(
      answer.text
    ) ||
    /^\s*(?:Q\.?\s*)?\d+\s*\([a-zA-Z0-9]+\)/i.test(
      answer.text
    );

  if (
    !hasLeadingQuestionLabel
  ) {
    finalContinuation =
      previousActiveQuestion;
  }
}

    /**
     * --------------------------------------------------------
     * SAFE REGIONS
     * --------------------------------------------------------
     */

    const safeRegions: {
      page: number;

      bbox: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }[] = [];

    for (
      const region of
        answer.regions
    ) {
      /**
       * This extractor processes one page only.
       */
      if (
        region.page !==
        page.pageNumber
      ) {
        continue;
      }

      const bbox =
        clampBoundingBox(
          region.bbox,
          page.imageWidth,
          page.imageHeight
        );

      safeRegions.push({
        page:
          page.pageNumber,

        bbox,
      });
    }

    if (
      safeRegions.length === 0
    ) {
      throw new Error(
        `Groq returned no valid region for answer ${index} on page ${page.pageNumber}.`
      );
    }

    /**
     * --------------------------------------------------------
     * Confidence
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
     * FINAL ANSWER
     * --------------------------------------------------------
     */

    const normalizedAnswer:
      Answer = {
        id:
          createAnswerId(
            page.pageNumber,
            index
          ),

        text:
          cleanAnswerText(
            answer.text
          ),

        /**
         * Preserve the original answer-sheet label.
         */
        studentQuestionNumber:
          studentQuestionNumber,

        /**
         * Canonical question only when Groq explicitly
         * provided a valid one.
         *
         * We no longer infer "3)" -> "1(c)" here.
         */
        explicitQuestionNumber:
          safeExplicitQuestion,

        /**
         * Continuation context.
         */
        continuationOf:
          safeExplicitQuestion
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