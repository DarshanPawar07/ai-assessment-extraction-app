import dotenv from "dotenv";

import {
  evaluateAnswer,
} from "./evaluator";

/**
 * Load environment variables.
 */
dotenv.config();

/**
 * Usage:
 *
 * npx ts-node src/ai/groq/test-evaluator.ts
 *
 * Optional custom values can be supplied through
 * command-line arguments.
 *
 * Example:
 *
 * npx ts-node src/ai/groq/test-evaluator.ts \
 *   "1(a)" \
 *   "Explain design concepts: i) Abstraction ii) Modularity" \
 *   "Your student answer here" \
 *   "6"
 */

async function main(): Promise<void> {
  const questionNumber =
    process.argv[2] ??
    "1(a)";

  const questionText =
    process.argv[3] ??
    `Explain design concepts:
i) Abstraction
ii) Modularity`;

  const studentAnswer =
    process.argv[4] ??
    `Abstraction is the process of hiding unnecessary details and showing only the essential features of a particular concept. In software, abstraction enables us to represent complex real-world problems in simplified models.

There are two types:
1) Procedural Abstraction
2) Data Abstraction

Procedural abstraction refers to a sequence of instructions that performs a specific function while hiding implementation details. For example, submitting a form hides formatting, sending data to the server, storing it in a database, and displaying confirmation.

Data abstraction represents only essential information while hiding internal storage details.`;

  const maxMarks =
    Number(
      process.argv[5] ??
        "6"
    );

  console.log(
    "Testing Groq answer evaluator"
  );

  console.log(
    "--------------------------------"
  );

  console.log(
    `Model: ${
      process.env.GROQ_EVALUATION_MODEL ??
      "qwen/qwen3.6-27b"
    }`
  );

  console.log(
    `Question: ${questionNumber}`
  );

  console.log(
    `Maximum marks: ${maxMarks}`
  );

  console.log(
    "\nQuestion:"
  );

  console.log(
    questionText
  );

  console.log(
    "\nStudent answer:"
  );

  console.log(
    studentAnswer
  );

  console.log(
    "\nSending ONE evaluation request to Groq..."
  );

  try {
    const result =
      await evaluateAnswer({
        assessmentId:
          "test-assessment",

        questionId:
          "test-question",

        questionNumber,

        questionText,

        studentAnswer,

        maxMarks,
      });

    console.log(
      "\nEvaluation result:"
    );

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

    console.log(
      "\n--------------------------------"
    );

    console.log(
      `Score: ${result.score}/${maxMarks}`
    );

    console.log(
      `Percentage: ${
        maxMarks > 0
          ? (
              result.score /
              maxMarks
            ) *
            100
          : 0
      }%`
    );

    console.log(
      `Confidence: ${result.confidence}`
    );

    console.log(
      "\nEvaluation:"
    );

    console.log(
      result.evaluation
    );

    console.log(
      "\nStrengths:"
    );

    if (
      result.strengths.length ===
      0
    ) {
      console.log(
        "None"
      );
    } else {
      result.strengths.forEach(
        (
          item,
          index
        ) => {
          console.log(
            `${index + 1}. ${item}`
          );
        }
      );
    }

    console.log(
      "\nWeaknesses:"
    );

    if (
      result.weaknesses.length ===
      0
    ) {
      console.log(
        "None"
      );
    } else {
      result.weaknesses.forEach(
        (
          item,
          index
        ) => {
          console.log(
            `${index + 1}. ${item}`
          );
        }
      );
    }
  } catch (
    error
  ) {
    console.error(
      "\nEvaluation test failed:"
    );

    if (
      error instanceof Error
    ) {
      console.error(
        error.message
      );
    } else {
      console.error(
        error
      );
    }

    process.exitCode =
      1;
  }
}

void main();