import path from "path";
import fs from "fs/promises";


import { DocumentFile, DocumentPage } from "../types/document";
import { getPdfPageDimensions } from "./page-dimensions";
import { convertPdfToImages } from "./pdf-to-images";
import { preprocessImage } from "./image-preprocessor";



const PDF_MIME_TYPE = "application/pdf";

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function processPdf(
  file: Express.Multer.File,
  documentId: string
): Promise<DocumentPage[]> {
  const outputDirectory = path.resolve(
    process.cwd(),
    "uploads",
    "processed",
    documentId
  );

  await fs.mkdir(outputDirectory, {
    recursive: true,
  });

  const pdfDimensions = await getPdfPageDimensions(file.path);

  const renderedPages = await convertPdfToImages(
    file.path,
    outputDirectory
  );

  if (pdfDimensions.length !== renderedPages.length) {
    throw new Error(
      "PDF page count does not match rendered page count."
    );
  }

  return renderedPages.map((renderedPage) => ({
    pageNumber: renderedPage.pageNumber,
    width: renderedPage.width,
    height: renderedPage.height,
    imagePath: renderedPage.imagePath,
  }));
}

async function processImage(
  file: Express.Multer.File,
  documentId: string
): Promise<DocumentPage[]> {
  const outputDirectory = path.resolve(
    process.cwd(),
    "uploads",
    "processed",
    documentId
  );

  await fs.mkdir(outputDirectory, {
    recursive: true,
  });

  const processedImage = await preprocessImage(
    file.path,
    outputDirectory,
    "page-1.png"
  );

  return [
    {
      pageNumber: 1,
      width: processedImage.width,
      height: processedImage.height,
      imagePath: processedImage.imagePath,
    },
  ];
}

export async function processDocumentFile(
  file: Express.Multer.File,
  documentId: string
): Promise<DocumentFile> {
  let pages: DocumentPage[];

  if (file.mimetype === PDF_MIME_TYPE) {
    pages = await processPdf(file, documentId);
  } else if (IMAGE_MIME_TYPES.has(file.mimetype)) {
    pages = await processImage(file, documentId);
  } else {
    throw new Error(
      "Unsupported file type. Only PDF, JPEG, PNG, and WebP are supported."
    );
  }

  return {
    id: documentId,
    originalName: file.originalname,
    mimeType: file.mimetype,
    path: path.resolve(file.path),
    pageCount: pages.length,
    pages,
  };
}