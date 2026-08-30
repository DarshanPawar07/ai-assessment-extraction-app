import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  resumeAnswerExtraction,
} from "../services/extraction.service";

/**
 * POST /api/extraction/answers/:assessmentId/resume
 */
export async function resumeAnswerExtractionController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const assessmentId =
      Array.isArray(
        req.params.assessmentId
      )
        ? req.params.assessmentId[0]
        : req.params.assessmentId;

    if (
      !assessmentId
    ) {
      res.status(400).json({
        success: false,
        message:
          "Assessment ID is required.",
      });

      return;
    }

    const assessment =
      await resumeAnswerExtraction(
        assessmentId
      );

    res.status(200).json({
      success: true,

      message:
        "Answer extraction resumed successfully.",

      assessment,
    });
  } catch (
    error
  ) {
    next(error);
  }
}