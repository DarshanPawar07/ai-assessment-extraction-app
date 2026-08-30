import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  evaluateAssessment,
  evaluateSingleQuestion,
  getEvaluationResults,
  getEvaluationSummary,
} from "../services/evaluation.service";

import {
  getAssessmentResult,
} from "../services/result.service";

/**
 * ============================================================
 * POST /api/evaluation/:assessmentId
 * ============================================================
 */
export async function evaluateAssessmentController(
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

    if (!assessmentId) {
      res.status(400).json({
        success: false,
        message:
          "Assessment ID is required.",
      });

      return;
    }

    const assessment =
      await evaluateAssessment(
        assessmentId
      );

    res.status(200).json({
      success: true,

      message:
        "Assessment evaluation completed successfully.",

      assessment,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * ============================================================
 * POST /api/evaluation/:assessmentId/:questionId
 * ============================================================
 *
 * Controlled one-question evaluation.
 */
export async function evaluateSingleQuestionController(
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

    const questionId =
      Array.isArray(
        req.params.questionId
      )
        ? req.params.questionId[0]
        : req.params.questionId;

    if (!assessmentId) {
      res.status(400).json({
        success: false,
        message:
          "Assessment ID is required.",
      });

      return;
    }

    if (!questionId) {
      res.status(400).json({
        success: false,
        message:
          "Question ID is required.",
      });

      return;
    }

    const evaluation =
      await evaluateSingleQuestion(
        assessmentId,
        questionId
      );

    res.status(200).json({
      success: true,

      message:
        `Question ${questionId} evaluated successfully.`,

      evaluation,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * ============================================================
 * GET /api/evaluation/:assessmentId
 * ============================================================
 *
 * ZERO GROQ CALLS.
 */
export function getEvaluationController(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const assessmentId =
      Array.isArray(
        req.params.assessmentId
      )
        ? req.params.assessmentId[0]
        : req.params.assessmentId;

    if (!assessmentId) {
      res.status(400).json({
        success: false,
        message:
          "Assessment ID is required.",
      });

      return;
    }

    const evaluations =
      getEvaluationResults(
        assessmentId
      );

    const summary =
      getEvaluationSummary(
        assessmentId
      );

    res.status(200).json({
      success: true,

      assessmentId,

      evaluations,

      summary,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * ============================================================
 * GET /api/evaluation/:assessmentId/summary
 * ============================================================
 *
 * ZERO GROQ CALLS.
 */
export function getEvaluationSummaryController(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const assessmentId =
      Array.isArray(
        req.params.assessmentId
      )
        ? req.params.assessmentId[0]
        : req.params.assessmentId;

    if (!assessmentId) {
      res.status(400).json({
        success: false,
        message:
          "Assessment ID is required.",
      });

      return;
    }

    const summary =
      getEvaluationSummary(
        assessmentId
      );

    res.status(200).json({
      success: true,

      assessmentId,

      summary,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * ============================================================
 * GET /api/evaluation/:assessmentId/result
 * ============================================================
 *
 * Frontend-ready result response.
 *
 * ZERO GROQ CALLS.
 */
export function getAssessmentResultController(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const assessmentId =
      Array.isArray(
        req.params.assessmentId
      )
        ? req.params.assessmentId[0]
        : req.params.assessmentId;

    if (!assessmentId) {
      res.status(400).json({
        success: false,
        message:
          "Assessment ID is required.",
      });

      return;
    }

    const result =
      getAssessmentResult(
        assessmentId
      );

    res.status(200).json({
      success: true,

      result,
    });
  } catch (error) {
    next(error);
  }
}