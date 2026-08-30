// TODO: Implement backend/src/document/coordinate-utils.ts
import { BoundingBox } from "../types/document";

export interface NormalizedBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Convert pixel coordinates to normalized coordinates (0-1).
 */
export function normalizeBoundingBox(
  bbox: BoundingBox,
  pageWidth: number,
  pageHeight: number
): NormalizedBoundingBox {
  if (pageWidth <= 0 || pageHeight <= 0) {
    throw new Error("Page dimensions must be greater than zero.");
  }

  return {
    x: bbox.x / pageWidth,
    y: bbox.y / pageHeight,
    width: bbox.width / pageWidth,
    height: bbox.height / pageHeight,
  };
}

/**
 * Convert normalized coordinates back to pixel coordinates.
 */
export function denormalizeBoundingBox(
  bbox: NormalizedBoundingBox,
  pageWidth: number,
  pageHeight: number
): BoundingBox {
  if (pageWidth <= 0 || pageHeight <= 0) {
    throw new Error("Page dimensions must be greater than zero.");
  }

  return {
    x: bbox.x * pageWidth,
    y: bbox.y * pageHeight,
    width: bbox.width * pageWidth,
    height: bbox.height * pageHeight,
  };
}

/**
 * Clamp a bounding box so it stays inside the page.
 */
export function clampBoundingBox(
  bbox: BoundingBox,
  pageWidth: number,
  pageHeight: number
): BoundingBox {
  const x = Math.max(0, Math.min(bbox.x, pageWidth));
  const y = Math.max(0, Math.min(bbox.y, pageHeight));

  const maxWidth = pageWidth - x;
  const maxHeight = pageHeight - y;

  const width = Math.max(0, Math.min(bbox.width, maxWidth));
  const height = Math.max(0, Math.min(bbox.height, maxHeight));

  return {
    x,
    y,
    width,
    height,
  };
}