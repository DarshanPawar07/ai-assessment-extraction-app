import fs from "fs/promises";
import path from "path";

import {
  extractAnswersFromPage,
  GroqAnswerPageInput,
} from "./answer-extractor";

const VALID_QUESTION_NUMBERS = [
  "1(a)",
  "1(b)",
  "1(c)",
  "2(a)",
  "2(b)",
  "3(a)",
  "3(b)",
  "4(a)",
  "4(b)",
  "5(a)",
  "5(b)",
  "5(c)",
  "6(a)",
  "6(b)",
  "7(a)",
  "7(b)",
  "8(a)",
  "8(b)",
];

async function validateImage(
  imagePath: string
): Promise<void> {
  try {
    await fs.access(imagePath);
  } catch {
    throw new Error(
      `Image does not exist:\n${imagePath}`
    );
  }
}

async function main(): Promise<void> {
  const imagePathArgument = process.argv[2];
  const pageNumberArgument = process.argv[3];
  const previousQuestionArgument = process.argv[4];

  if (!imagePathArgument) {
    throw new Error(
      "Please provide the answer-sheet PNG path."
    );
  }

  if (!pageNumberArgument) {
    throw new Error(
      "Please provide the page number."
    );
  }

  const pageNumber = Number(
    pageNumberArgument
  );

  if (
    !Number.isInteger(pageNumber) ||
    pageNumber <= 0
  ) {
    throw new Error(
      "Page number must be a positive integer."
    );
  }

  const imagePath =
    path.resolve(
      imagePathArgument
    );

  await validateImage(imagePath);

  const dimensions = {
    width: 768,
    height: 1086,
  };

  const page: GroqAnswerPageInput = {
    imagePath,
    pageNumber,
    imageWidth: dimensions.width,
    imageHeight: dimensions.height,
  };

  console.log(
    "Testing Groq answer extraction"
  );

  console.log(
    "--------------------------------"
  );

  console.log(
    "Model: qwen/qwen3.6-27b"
  );

  console.log(
    `Page: ${pageNumber}`
  );

  console.log(
    `Previous active question: ${
      previousQuestionArgument ?? "NONE"
    }`
  );

  console.log();
  console.log(
    "Image:"
  );

  console.log(imagePath);

  console.log();
  console.log(
    "Image dimensions:"
  );

  console.log(dimensions);

  console.log();
  console.log(
    "Sending ONE image to Groq..."
  );

  const answers =
    await extractAnswersFromPage({
      page,

      validQuestionNumbers:
        VALID_QUESTION_NUMBERS,

      previousActiveQuestionNumber:
        previousQuestionArgument,
    });

  console.log();
  console.log(
    "Extracted answers:"
  );

  console.log(
    JSON.stringify(
      answers,
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error();
  console.error(
    "Groq answer extraction test failed:"
  );

  if (error instanceof Error) {
    console.error(
      error.message
    );

    if (error.stack) {
      console.error();
      console.error(
        error.stack
      );
    }
  } else {
    console.error(
      error
    );
  }

  process.exit(1);
});