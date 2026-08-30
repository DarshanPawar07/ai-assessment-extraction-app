import Groq from "groq-sdk";

import {
  EvaluationResult,
} from "../../types/evaluation";

import {
  buildEvaluationPrompt,
} from "./prompts/evaluation.prompt";

import {
  withGroqRetry,
} from "./rate-limit";

/**
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */

const MODEL =
  process.env.GROQ_EVALUATION_MODEL ||
  "qwen/qwen3.6-27b";

/**
 * Keep evaluator responses small.
 */
const MAX_OUTPUT_TOKENS = 700;

/**
 * Number of fresh requests allowed when the model
 * returns invalid JSON.
 *
 * This is separate from rate-limit retries.
 */
const MAX_EVALUATION_ATTEMPTS = 3;

/**
 * ============================================================
 * GROQ CLIENT
 * ============================================================
 */

function getGroqClient(): Groq {
  const apiKey =
    process.env.GROQ_API_KEY;

  if (
    !apiKey ||
    !apiKey.trim()
  ) {
    throw new Error(
      "GROQ_API_KEY is missing or empty. Make sure .env is loaded before evaluation."
    );
  }

  return new Groq({
    apiKey,
  });
}

/**
 * ============================================================
 * INPUT
 * ============================================================
 */

export interface EvaluateAnswerInput {
  assessmentId: string;
  questionId: string;
  questionNumber: string;
  questionText: string;
  studentAnswer: string;
  maxMarks: number;
}

/**
 * ============================================================
 * AI RESULT
 * ============================================================
 */

export interface AIAnswerEvaluation {
  score: number;
  evaluation: string;
  strengths: string[];
  weaknesses: string[];
  confidence: number;
}

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

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

function toFiniteNumber(
  value: unknown
): number | undefined {
  const result =
    typeof value === "number"
      ? value
      : Number(value);

  if (
    !Number.isFinite(result)
  ) {
    return undefined;
  }

  return result;
}

function normalizeStringArray(
  value: unknown
): string[] {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return value
    .filter(
      (
        item
      ): item is string =>
        typeof item === "string"
    )
    .map(
      (
        item
      ) =>
        item.trim()
    )
    .filter(Boolean);
}

/**
 * ============================================================
 * REMOVE THINKING OUTPUT
 * ============================================================
 */

function removeThinking(
  content: string
): string {
  let result =
    content;

  /**
   * Remove complete <think>...</think> blocks.
   */
  result =
    result.replace(
      /<think\b[^>]*>[\s\S]*?<\/think>/gi,
      ""
    );

  /**
   * If the model starts thinking but forgets the closing
   * tag, remove everything before the JSON object.
   */
  const jsonStart =
    result.indexOf("{");

  const thinkStart =
    result.toLowerCase().indexOf("<think");

  if (
    thinkStart !== -1 &&
    jsonStart !== -1 &&
    thinkStart < jsonStart
  ) {
    result =
      result.slice(
        jsonStart
      );
  }

  return result.trim();
}

/**
 * ============================================================
 * CLEAN MARKDOWN / EXTRA TEXT
 * ============================================================
 */

function cleanModelOutput(
  content: string
): string {
  let cleaned =
    removeThinking(
      content
    );

  /**
   * Remove markdown fences.
   */
  cleaned =
    cleaned.replace(
      /```json/gi,
      ""
    );

  cleaned =
    cleaned.replace(
      /```/g,
      ""
    );

  return cleaned.trim();
}

/**
 * ============================================================
 * FIND JSON OBJECT
 * ============================================================
 *
 * Finds the first balanced JSON object while respecting
 * strings and escaped characters.
 */

function findBalancedJsonObject(
  content: string
): string | undefined {
  const start =
    content.indexOf("{");

  if (
    start === -1
  ) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (
    let index = start;
    index < content.length;
    index += 1
  ) {
    const character =
      content[index];

    if (
      escaped
    ) {
      escaped = false;
      continue;
    }

    if (
      character === "\\"
    ) {
      escaped = true;
      continue;
    }

    if (
      character === '"'
    ) {
      inString =
        !inString;

      continue;
    }

    if (
      inString
    ) {
      continue;
    }

    if (
      character === "{"
    ) {
      depth += 1;
    } else if (
      character === "}"
    ) {
      depth -= 1;

      if (
        depth === 0
      ) {
        return content.slice(
          start,
          index + 1
        );
      }
    }
  }

  return undefined;
}

/**
 * ============================================================
 * COMMON JSON REPAIRS
 * ============================================================
 *
 * These repairs handle minor formatting mistakes from
 * language models without attempting dangerous rewriting.
 */

function repairJson(
  json: string
): string {
  let repaired =
    json.trim();

  /**
   * Remove trailing commas before } or ].
   */
  repaired =
    repaired.replace(
      /,\s*([}\]])/g,
      "$1"
    );

  /**
   * Convert smart quotes to normal quotes.
   */
  repaired =
    repaired
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");

  return repaired;
}

/**
 * ============================================================
 * EXTRACT JSON
 * ============================================================
 */

function extractJsonObject(
  content: string
): string {
  const cleaned =
    cleanModelOutput(
      content
    );

  /**
   * First attempt:
   * Entire response is JSON.
   */
  try {
    JSON.parse(
      cleaned
    );

    return cleaned;
  } catch {
    // Continue.
  }

  /**
   * Second attempt:
   * Find a balanced object.
   */
  const balanced =
    findBalancedJsonObject(
      cleaned
    );

  if (
    !balanced
  ) {
    throw new Error(
      `Evaluator response does not contain a complete JSON object. Raw response: ${content}`
    );
  }

  /**
   * Third attempt:
   * Parse the extracted object.
   */
  try {
    JSON.parse(
      balanced
    );

    return balanced;
  } catch {
    // Continue with safe repair.
  }

  const repaired =
    repairJson(
      balanced
    );

  try {
    JSON.parse(
      repaired
    );

    return repaired;
  } catch (
    error
  ) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown JSON parsing error.";

    throw new Error(
      `Evaluator returned malformed JSON: ${message}`
    );
  }
}

/**
 * ============================================================
 * PARSE EVALUATION JSON
 * ============================================================
 */

function parseEvaluationJson(
  content: string
): AIAnswerEvaluation {
  const jsonText =
    extractJsonObject(
      content
    );

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(
        jsonText
      );
  } catch (
    error
  ) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown JSON parsing error.";

    throw new Error(
      `Evaluator returned malformed JSON: ${message}`
    );
  }

  if (
    !parsed ||
    typeof parsed !== "object"
  ) {
    throw new Error(
      "Evaluator returned an invalid JSON object."
    );
  }

  return parsed as AIAnswerEvaluation;
}

/**
 * ============================================================
 * NORMALIZE / VALIDATE
 * ============================================================
 */

function normalizeEvaluation(
  raw: AIAnswerEvaluation,
  maxMarks: number
): AIAnswerEvaluation {
  if (
    !raw ||
    typeof raw !== "object"
  ) {
    throw new Error(
      "Evaluator returned an invalid result object."
    );
  }

  const score =
    toFiniteNumber(
      raw.score
    );

  if (
    score === undefined
  ) {
    throw new Error(
      "Evaluator returned an invalid score."
    );
  }

  const confidence =
    toFiniteNumber(
      raw.confidence
    );

  if (
    confidence === undefined
  ) {
    throw new Error(
      "Evaluator returned an invalid confidence."
    );
  }

  const evaluation =
    typeof raw.evaluation === "string"
      ? raw.evaluation.trim()
      : "";

  if (
    !evaluation
  ) {
    throw new Error(
      "Evaluator returned an empty evaluation."
    );
  }

  return {
    score:
      Number(
        clamp(
          score,
          0,
          maxMarks
        ).toFixed(2)
      ),

    evaluation,

    strengths:
      normalizeStringArray(
        raw.strengths
      ),

    weaknesses:
      normalizeStringArray(
        raw.weaknesses
      ),

    confidence:
      Number(
        clamp(
          confidence,
          0,
          1
        ).toFixed(3)
      ),
  };
}

/**
 * ============================================================
 * CREATE GROQ REQUEST
 * ============================================================
 */

async function requestEvaluation(
  groq: Groq,
  prompt: string,
  forceJsonRetry: boolean
): Promise<string> {
  /**
   * On the first request we use the normal prompt.
   *
   * On subsequent invalid-JSON attempts we explicitly
   * reinforce the JSON requirement.
   */
  const finalPrompt =
    forceJsonRetry
      ? `${prompt}

IMPORTANT RETRY INSTRUCTION:
Your previous response was invalid JSON.

Return ONLY one valid JSON object.
Do not include <think>.
Do not include reasoning.
Do not include markdown.
Do not include text before or after the JSON object.

The first character of your response must be {.
The last character of your response must be }.

Use this exact structure:
{"score":0,"evaluation":"brief explanation","strengths":["brief item"],"weaknesses":["brief item"],"confidence":0}`
      : prompt;

  const response =
    await withGroqRetry(
      () =>
        groq.chat.completions.create(
          {
            model:
              MODEL,

            temperature:
              0,

            max_tokens:
              MAX_OUTPUT_TOKENS,

            /**
             * Ask Groq for JSON explicitly.
             *
             * Qwen/Groq may still expose reasoning, therefore
             * the local parser remains necessary.
             */
            response_format: {
              type: "json_object",
            },

            messages: [
              {
                role:
                  "system",

                content:
                  [
                    "You are an academic examination evaluator.",
                    "Evaluate the student's examination answer.",
                    "Return exactly one valid JSON object.",
                    "Do not return reasoning.",
                    "Do not return <think> tags.",
                    "Do not return markdown.",
                    "Do not return any text outside JSON.",
                    "The JSON must contain exactly these fields:",
                    "score, evaluation, strengths, weaknesses, confidence.",
                    "score must be between 0 and the maximum marks.",
                    "confidence must be between 0 and 1.",
                  ].join(" "),
              },

              {
                role:
                  "user",

                content:
                  finalPrompt,
              },
            ],
          }
        )
    );

  const content =
    response
      .choices?.[0]
      ?.message
      ?.content;

  if (
    typeof content !== "string" ||
    !content.trim()
  ) {
    throw new Error(
      "Evaluator returned an empty model response."
    );
  }

  return content;
}

/**
 * ============================================================
 * EVALUATE ONE ANSWER
 * ============================================================
 */

export async function evaluateAnswer(
  input: EvaluateAnswerInput
): Promise<AIAnswerEvaluation> {
  const groq =
    getGroqClient();

  /**
   * Basic validation.
   */
  if (
    !input.assessmentId.trim()
  ) {
    throw new Error(
      "Assessment ID cannot be empty."
    );
  }

  if (
    !input.questionId.trim()
  ) {
    throw new Error(
      "Question ID cannot be empty."
    );
  }

  if (
    !input.questionNumber.trim()
  ) {
    throw new Error(
      "Question number cannot be empty."
    );
  }

  if (
    !Number.isFinite(
      input.maxMarks
    ) ||
    input.maxMarks <= 0
  ) {
    throw new Error(
      "Maximum marks must be a finite number greater than zero."
    );
  }

  const questionText =
    input.questionText.trim();

  if (
    !questionText
  ) {
    throw new Error(
      "Question text cannot be empty."
    );
  }

  const studentAnswer =
    input.studentAnswer.trim();

  if (
    !studentAnswer
  ) {
    throw new Error(
      "Student answer cannot be empty."
    );
  }

  const prompt =
    buildEvaluationPrompt({
      questionNumber:
        input.questionNumber,

      questionText,

      maxMarks:
        input.maxMarks,

      studentAnswer,
    });

  let lastError:
    | unknown
    | undefined;

  /**
   * ==========================================================
   * INVALID JSON RETRY LOOP
   * ==========================================================
   */

  for (
    let attempt = 1;
    attempt <=
    MAX_EVALUATION_ATTEMPTS;
    attempt += 1
  ) {
    try {
      console.log(
        `[Evaluation] Evaluating ${input.questionNumber} (${input.questionId}) attempt ${attempt}/${MAX_EVALUATION_ATTEMPTS}`
      );

      const content =
        await requestEvaluation(
          groq,
          prompt,
          attempt > 1
        );

      console.log(
        `[Evaluation] Raw model response length: ${content.length}`
      );

      /**
       * Only print a limited preview to avoid filling
       * the terminal with model reasoning.
       */
      console.log(
        `[Evaluation] Raw model response preview: ${content.slice(
          0,
          300
        )}`
      );

      const parsed =
        parseEvaluationJson(
          content
        );

      const normalized =
        normalizeEvaluation(
          parsed,
          input.maxMarks
        );

      console.log(
        `[Evaluation] ${input.questionNumber}: ${normalized.score}/${input.maxMarks}`
      );

      return normalized;
    } catch (
      error
    ) {
      lastError =
        error;

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        `[Evaluation] Attempt ${attempt} failed for ${input.questionNumber}: ${message}`
      );

      /**
       * If this was the final evaluation attempt,
       * return the error to the process controller.
       */
      if (
        attempt >=
        MAX_EVALUATION_ATTEMPTS
      ) {
        break;
      }

      console.warn(
        `[Evaluation] Model output was invalid. Requesting a fresh evaluation for ${input.questionNumber}.`
      );
    }
  }

  throw (
    lastError instanceof Error
      ? lastError
      : new Error(
          "Evaluation failed after multiple attempts."
        )
  );
}

/**
 * ============================================================
 * CREATE PERSISTENT EVALUATION RESULT
 * ============================================================
 */

export function createEvaluationResult(
  input: EvaluateAnswerInput,
  evaluation: AIAnswerEvaluation,
  answerId: string
): EvaluationResult {
  if (
    !answerId.trim()
  ) {
    throw new Error(
      "Answer ID cannot be empty."
    );
  }

  const score =
    clamp(
      evaluation.score,
      0,
      input.maxMarks
    );

  const percentage =
    input.maxMarks > 0
      ? (
          score /
          input.maxMarks
        ) *
        100
      : 0;

  return {
    id:
      `evaluation-${input.questionId}`,

    assessmentId:
      input.assessmentId,

    questionId:
      input.questionId,

    questionNumber:
      input.questionNumber,

    answerId,

    maxMarks:
      input.maxMarks,

    score:
      Number(
        score.toFixed(2)
      ),

    percentage:
      Number(
        clamp(
          percentage,
          0,
          100
        ).toFixed(2)
      ),

    evaluation:
      evaluation.evaluation,

    strengths:
      evaluation.strengths,

    weaknesses:
      evaluation.weaknesses,

    confidence:
      Number(
        clamp(
          evaluation.confidence,
          0,
          1
        ).toFixed(3)
      ),

    createdAt:
      new Date().toISOString(),
  };
}