import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  extractQuestionsForAssessment,
  extractAnswersForAssessment,
  extractAnswerPagesForAssessment,
} from "../services/assessment.service";

/**
 * ============================================================
 * QUESTION EXTRACTION
 * ============================================================
 *
 * POST /api/extraction/questions/:assessmentId
 */
export async function extractQuestionsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { assessmentId } = req.params;

    if (typeof assessmentId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid assessment ID.",
      });

      return;
    }

    const assessment =
      await extractQuestionsForAssessment(
        assessmentId
      );

    res.status(200).json({
      success: true,

      message:
        "Question extraction completed successfully.",

      assessment: {
        id: assessment.id,

        status:
          assessment.status,

        progress:
          assessment.progress,

        questions:
          assessment.questions,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * ============================================================
 * FULL ANSWER EXTRACTION
 * ============================================================
 *
 * POST /api/extraction/answers/:assessmentId
 *
 * Processes every page of the answer sheet.
 */
export async function extractAnswersController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { assessmentId } = req.params;

    if (typeof assessmentId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid assessment ID.",
      });

      return;
    }

    const assessment =
      await extractAnswersForAssessment(
        assessmentId
      );

    res.status(200).json({
      success: true,

      message:
        "Answer extraction completed successfully.",

      assessment: {
        id: assessment.id,

        status:
          assessment.status,

        progress:
          assessment.progress,

        answers:
          assessment.answers,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * ============================================================
 * ANSWER PAGE-RANGE EXTRACTION
 * ============================================================
 *
 * Development/testing endpoint.
 *
 * Example:
 *
 * POST
 * /api/extraction/answers/:assessmentId/pages?startPage=1&endPage=7
 *
 * This allows us to test a small range of pages before
 * processing the complete answer sheet.
 */
export async function extractAnswerPagesController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { assessmentId } = req.params;

    if (typeof assessmentId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid assessment ID.",
      });

      return;
    }

    const startPage =
      Number(req.query.startPage);

    const endPage =
      Number(req.query.endPage);

    if (
      !Number.isInteger(startPage) ||
      !Number.isInteger(endPage)
    ) {
      res.status(400).json({
        success: false,
        message:
          "startPage and endPage must be integers.",
      });

      return;
    }

    if (
      startPage < 1 ||
      endPage < 1 ||
      startPage > endPage
    ) {
      res.status(400).json({
        success: false,
        message:
          "Invalid page range.",
      });

      return;
    }

    const assessment =
      await extractAnswerPagesForAssessment(
        assessmentId,
        startPage,
        endPage
      );

    res.status(200).json({
      success: true,

      message:
        `Answer extraction completed for pages ${startPage}-${endPage}.`,

      assessment: {
        id: assessment.id,

        status:
          assessment.status,

        progress:
          assessment.progress,

        answers:
          assessment.answers,
      },
    });
  } catch (error) {
    next(error);
  }
}