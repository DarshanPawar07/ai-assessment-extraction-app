// TODO: Implement backend/src/document/page-dimensions.ts
import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

export interface PageDimensions {
  width: number;
  height: number;
}

export async function getPdfPageDimensions(
  filePath: string
): Promise<PageDimensions[]> {
  const fileBuffer = await fs.readFile(filePath);

  const pdfDocument = await PDFDocument.load(fileBuffer);

  return pdfDocument.getPages().map((page) => {
    const { width, height } = page.getSize();

    return {
      width,
      height,
    };
  });
}

export async function getImageDimensions(
  filePath: string
): Promise<PageDimensions> {
  const metadata = await sharp(filePath).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(
      `Unable to determine image dimensions for: ${path.basename(filePath)}`
    );
  }

  return {
    width: metadata.width,
    height: metadata.height,
  };
}