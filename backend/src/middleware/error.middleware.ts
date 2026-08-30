// TODO: Implement backend/src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from "express";
import multer from "multer";

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        success: false,
        message: "File size exceeds the 20 MB limit.",
      });

      return;
    }

    res.status(400).json({
      success: false,
      message: `Upload error: ${error.message}`,
    });

    return;
  }

  if (error instanceof Error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });

    return;
  }

  res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
}