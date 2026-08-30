import fs from "fs/promises";
import path from "path";

// Make GraphicsMagick available to Node/pdf2pic on Windows.
const GRAPHICSMAGICK_DIR =
  "C:\\Program Files\\GraphicsMagick-1.3.43-Q8";

if (process.platform === "win32") {
  const currentPath = process.env.PATH ?? "";

  if (!currentPath
    .toLowerCase()
    .split(";")
    .includes(GRAPHICSMAGICK_DIR.toLowerCase())) {
    process.env.PATH = `${GRAPHICSMAGICK_DIR};${currentPath}`;
  }
}

import { fromPath } from "pdf2pic";

export interface RenderedPdfPage {
  pageNumber: number;
  imagePath: string;
  width: number;
  height: number;
}

const DEFAULT_DENSITY = 150;

export async function convertPdfToImages(
  pdfPath: string,
  outputDirectory: string,
  density: number = DEFAULT_DENSITY
): Promise<RenderedPdfPage[]> {
  await fs.mkdir(outputDirectory, {
    recursive: true,
  });

  const baseName = path.basename(
    pdfPath,
    path.extname(pdfPath)
  );

  const converter = fromPath(pdfPath, {
    density,
    saveFilename: `${baseName}-page`,
    savePath: outputDirectory,
    format: "png",
    preserveAspectRatio: true,
  });

  const results = await converter.bulk(-1, {
    responseType: "image",
  });

  if (!results || results.length === 0) {
    throw new Error("No pages were rendered from the PDF.");
  }

  const sharp = (await import("sharp")).default;

  const pages: RenderedPdfPage[] = [];

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];

    if (!result.path) {
      throw new Error(
        `PDF page ${index + 1} was rendered without an output path.`
      );
    }

    const imagePath = path.resolve(result.path);

    const imageMetadata = await sharp(imagePath).metadata();

    if (!imageMetadata.width || !imageMetadata.height) {
      throw new Error(
        `Unable to determine dimensions for PDF page ${index + 1}.`
      );
    }

    pages.push({
      pageNumber: index + 1,
      imagePath,
      width: imageMetadata.width,
      height: imageMetadata.height,
    });
  }

  return pages;
}