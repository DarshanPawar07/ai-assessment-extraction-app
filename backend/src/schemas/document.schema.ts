import { z } from "zod";

export const boundingBoxSchema = z.object({
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const documentPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  imagePath: z.string().optional(),
});

export const documentFileSchema = z.object({
  id: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  path: z.string().min(1),
  pageCount: z.number().int().positive(),
  pages: z.array(documentPageSchema),
});

export type BoundingBoxInput = z.infer<typeof boundingBoxSchema>;
export type DocumentPageInput = z.infer<typeof documentPageSchema>;
export type DocumentFileInput = z.infer<typeof documentFileSchema>;