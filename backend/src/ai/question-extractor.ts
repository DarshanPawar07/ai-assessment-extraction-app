import fs from "fs/promises";

import { gemini, GEMINI_MODEL } from "./client";
import { QUESTION_EXTRACTION_PROMPT } from "./prompts/question-extraction.prompt";

import { Question } from "../types/question";
import { questionExtractionResultSchema } from "../schemas/question.schema";

import { clampBoundingBox } from "../document/coordinate-utils";

interface ExtractQuestionsOptions {
  imagePath: string;
  pageNumber: number;
  imageWidth: number;
  imageHeight: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanQuestionText(
  text: string,
  questionNumber: string
): string {
  let cleaned = text.trim();

  const numberParts = questionNumber.match(
    /^(\d+)(?:\(([a-zA-Z0-9]+)\))?(?:\(([a-zA-Z0-9]+)\))?$/
  );

  if (!numberParts) {
    return cleaned;
  }

  const topLevelNumber = numberParts[1];
  const firstPart = numberParts[2];
  const secondPart = numberParts[3];

  const patterns: string[] = [];

  if (firstPart && secondPart) {
    patterns.push(
      `Q${topLevelNumber}\\)\\s*${escapeRegExp(
        firstPart
      )}\\)\\s*${escapeRegExp(secondPart)}\\)`,
      `${topLevelNumber}\\)\\s*${escapeRegExp(
        firstPart
      )}\\)\\s*${escapeRegExp(secondPart)}\\)`,
      `${topLevelNumber}\\s*\\(\\s*${escapeRegExp(
        firstPart
      )}\\s*\\)\\s*\\(\\s*${escapeRegExp(secondPart)}\\s*\\)`,
      `${topLevelNumber}\\s*${escapeRegExp(
        firstPart
      )}\\s*\\)\\s*${escapeRegExp(secondPart)}\\s*\\)`
    );
  } else if (firstPart) {
    patterns.push(
      `Q${topLevelNumber}\\)\\s*${escapeRegExp(firstPart)}\\)`,
      `${topLevelNumber}\\)\\s*${escapeRegExp(firstPart)}\\)`,
      `${topLevelNumber}\\s*\\(\\s*${escapeRegExp(
        firstPart
      )}\\s*\\)`,
      `${topLevelNumber}\\s*${escapeRegExp(firstPart)}\\)`
    );
  } else {
    patterns.push(
      `Q${topLevelNumber}\\)`,
      `${topLevelNumber}\\.`,
      `${topLevelNumber}\\)`
    );
  }

  for (const pattern of patterns) {
    const regex = new RegExp(`^\\s*${pattern}\\s*`, "i");

    if (regex.test(cleaned)) {
      cleaned = cleaned.replace(regex, "").trim();
      break;
    }
  }

  return cleaned;
}

export async function extractQuestionsFromPage(
  options: ExtractQuestionsOptions
): Promise<Question[]> {
  const imageBuffer = await fs.readFile(options.imagePath);

  const base64Image = imageBuffer.toString("base64");

  const prompt = `
${QUESTION_EXTRACTION_PROMPT}

PAGE INFORMATION:

Page number: ${options.pageNumber}

Image width: ${options.imageWidth}

Image height: ${options.imageHeight}

Return exactly:

{
  "questions": [
    {
      "id": "q1-a",
      "number": "1(a)",
      "text": "Complete question text WITHOUT the question label",
      "page": ${options.pageNumber},
      "bbox": {
        "x": 100,
        "y": 200,
        "width": 500,
        "height": 50
      },
      "parentNumber": "1",
      "isSubPart": true,
      "order": 0,
      "maxMarks": 5
    }
  ]
}

IMPORTANT TEXT RULE:

The "number" field contains the question label.

Therefore the "text" field MUST NOT begin with:

Q1)
Q2)
1)
2)
a)
b)
c)
1(a)
1(b)
2(a)
etc.

Return only the actual question wording in the "text" field.

IMPORTANT BOUNDING BOX RULE:

All bounding boxes MUST remain completely inside:

x: 0 to ${options.imageWidth}
y: 0 to ${options.imageHeight}

Do not return a box extending beyond the image boundaries.
`;

  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt,
          },
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  const responseText = response.text;

  if (!responseText) {
    throw new Error(
      `Gemini returned an empty response for question-paper page ${options.pageNumber}.`
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(responseText);
  } catch {
    console.error(
      `Invalid JSON returned by Gemini for page ${options.pageNumber}:`,
      responseText
    );

    throw new Error(
      `Gemini returned invalid JSON for question-paper page ${options.pageNumber}.`
    );
  }

  const validationResult =
    questionExtractionResultSchema.safeParse(parsed);

  if (!validationResult.success) {
    console.error(
      `Invalid question extraction response for page ${options.pageNumber}:`,
      validationResult.error.flatten()
    );

    throw new Error(
      `Gemini response failed question schema validation on page ${options.pageNumber}.`
    );
  }

  return validationResult.data.questions.map((question) => {
    const cleanedText = cleanQuestionText(
      question.text,
      question.number
    );

    const clampedBBox = clampBoundingBox(
      question.bbox,
      options.imageWidth,
      options.imageHeight
    );

    return {
      ...question,
      text: cleanedText,
      bbox: clampedBBox,
    };
  });
}