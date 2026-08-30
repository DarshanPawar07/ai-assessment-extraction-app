import fs from "fs/promises";
import path from "path";

import { extractQuestionsFromPage } from "./question-extractor";
import { getImageDimensions } from "../document/page-dimensions";

async function main() {
  const imagePathArgument = process.argv[2];

  if (!imagePathArgument) {
    throw new Error(
      "Please provide the path to a question-paper PNG."
    );
  }

  const imagePath = path.resolve(imagePathArgument);

  try {
    await fs.access(imagePath);
  } catch {
    throw new Error(
      `Image file does not exist: ${imagePath}`
    );
  }

  console.log("Testing question extraction with:");
  console.log(imagePath);

  const dimensions = await getImageDimensions(imagePath);

  console.log("Image dimensions:");
  console.log(dimensions);

  const questions = await extractQuestionsFromPage({
    imagePath,
    pageNumber: 1,
    imageWidth: dimensions.width,
    imageHeight: dimensions.height,
  });

  console.log("\nExtracted questions:\n");

  console.log(
    JSON.stringify(questions, null, 2)
  );
}

main().catch((error) => {
  console.error("\nQuestion extraction test failed:");
  console.error(error);

  process.exit(1);
});