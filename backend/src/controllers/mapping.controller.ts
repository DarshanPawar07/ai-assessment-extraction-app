// TODO: Implement backend/src/controllers/mapping.controller.ts
import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  mapAssessmentAnswers,
  getMappingSummary,
} from "../services/mapping.service";

/**
 * ============================================================
 * MAP ANSWERS TO QUESTIONS
 * ============================================================
 *
 * POST /api/extraction/mapping/:assessmentId
 */
export async function mapAssessmentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { assessmentId } =
      req.params;

    if (
      typeof assessmentId !==
      "string"
    ) {
      res.status(400).json({
        success: false,
        message:
          "Invalid assessment ID.",
      });

      return;
    }

    const assessment =
      await mapAssessmentAnswers(
        assessmentId
      );

    const summary =
      getMappingSummary(
        assessment
      );

    res.status(200).json({
      success: true,

      message:
        "Answer mapping completed successfully.",

      assessment: {
        id:
          assessment.id,

        status:
          assessment.status,

        progress:
          assessment.progress,

        mappings:
          assessment.mappings,

        mappingSummary:
          summary,
      },
    });
  } catch (error) {
    next(error);
  }
}