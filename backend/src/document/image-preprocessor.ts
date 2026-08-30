// TODO: Implement backend/src/document/image-preprocessor.ts
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

export interface ProcessedImage {
  imagePath: string;
  width: number;
  height: number;
}

export async function preprocessImage(
  inputPath: string,
  outputDirectory: string,
  outputName?: string
): Promise<ProcessedImage> {
  await fs.mkdir(outputDirectory, {
    recursive: true,
  });

  const inputName =
    outputName ??
    `${path.basename(inputPath, path.extname(inputPath))}-normalized.png`;

  const outputPath = path.resolve(outputDirectory, inputName);

  const image = sharp(inputPath, {
    failOn: "warning",
  });

  const processed = await image
    .rotate()
    .png({
      compressionLevel: 6,
    })
    .toFile(outputPath);

  return {
    imagePath: outputPath,
    width: processed.width,
    height: processed.height,
  };
}