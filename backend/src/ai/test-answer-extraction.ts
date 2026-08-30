import fs from "fs/promises";
import path from "path";

import { extractAnswersFromPage } from "./answer-extractor";
import { getImageDimensions } from "../document/page-dimensions";

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

async function main() {
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
    path.resolve(imagePathArgument);

  try {
    await fs.access(imagePath);
  } catch {
    throw new Error(
      `Image file does not exist: ${imagePath}`
    );
  }

  console.log(
    "Testing answer extraction with:"
  );

  console.log(imagePath);

  console.log(
    `Page number: ${pageNumber}`
  );

  console.log(
    `Previous active question: ${
      previousQuestionArgument ?? "NONE"
    }`
  );

  const dimensions =
    await getImageDimensions(
      imagePath
    );

  console.log(
    "Image dimensions:"
  );

  console.log(dimensions);

  const answers =
    await extractAnswersFromPage({
      imagePath,
      pageNumber,
      imageWidth: dimensions.width,
      imageHeight: dimensions.height,

      validQuestionNumbers:
        VALID_QUESTION_NUMBERS,

      previousActiveQuestionNumber:
        previousQuestionArgument,
    });

  console.log(
    "\nExtracted answers:\n"
  );

  console.log(
    JSON.stringify(
      answers,
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    "\nAnswer extraction test failed:"
  );

  console.error(error);

  process.exit(1);
});