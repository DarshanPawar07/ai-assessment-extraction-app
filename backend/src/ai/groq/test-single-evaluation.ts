import dotenv from "dotenv";

dotenv.config();

import {
  evaluateSingleQuestion,
} from "../../services/evaluation.service";

async function main(): Promise<void> {
  const assessmentId =
    process.argv[2];

  const questionId =
    process.argv[3] ?? "q1-a";

  if (!assessmentId) {
    console.error(
      "Usage: npx ts-node src/ai/groq/test-single-evaluation.ts <assessmentId> [questionId]"
    );

    process.exitCode = 1;
    return;
  }

  console.log(
    "Testing single-question evaluation"
  );

  console.log(
    "-----------------------------------"
  );

  console.log(
    `Assessment: ${assessmentId}`
  );

  console.log(
    `Question: ${questionId}`
  );

  try {
    const result =
      await evaluateSingleQuestion(
        assessmentId,
        questionId
      );

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
      "\n-----------------------------------"
    );

    console.log(
      `Score: ${result.score}/${result.maxMarks}`
    );

    console.log(
      `Percentage: ${result.percentage}%`
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
  } catch (
    error
  ) {
    console.error(
      "\nSingle-question evaluation failed:"
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

    process.exitCode = 1;
  }
}

void main();