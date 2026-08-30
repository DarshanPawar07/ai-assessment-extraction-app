import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  processAssessment,
  getProcessStatus,
  dryRunAssessmentProcess,
} from "../services/process.service";

/**
 * ============================================================
 * POST /api/assessment/:assessmentId/process
 * ============================================================
 *
 * Starts the assessment processing pipeline asynchronously.
 *
 * The HTTP request does NOT wait for:
 *
 * - question extraction
 * - answer extraction
 * - mapping
 * - evaluation
 */
export function startAssessmentProcessController(
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

    /**
     * Verify assessment exists before
     * starting background processing.
     */
    const status =
      getProcessStatus(
        assessmentId
      );

    /**
     * Already completed.
     */
    if (
      status.evaluationComplete &&
      status.status ===
        "completed"
    ) {
      res.status(200).json({
        success: true,

        message:
          "Assessment has already been completely processed.",

        assessmentId,

        status,
      });

      return;
    }

    /**
     * Prevent duplicate processing requests.
     */
    const activeStatuses = [
      "processing",
      "extracting_questions",
      "extracting_answers",
      "mapping_answers",
      "evaluating",
    ];

    if (
      activeStatuses.includes(
        status.status
      )
    ) {
      res.status(202).json({
        success: true,

        message:
          "Assessment processing is already in progress.",

        assessmentId,

        status,
      });

      return;
    }

    /**
     * Start pipeline in background.
     *
     * Do not await it.
     */
    void processAssessment(
      assessmentId
    ).catch(
      (
        error
      ) => {
        const message =
          error instanceof Error
            ? error.message
            : "Assessment processing failed.";

        console.error(
          `[Process Controller] Background processing failed for ${assessmentId}: ${message}`
        );
      }
    );

    /**
     * Return immediately.
     */
    res.status(202).json({
      success: true,

      message:
        "Assessment processing started.",

      assessmentId,

      status:
        "processing_started",
    });
  } catch (
    error
  ) {
    next(error);
  }
}

/**
 * ============================================================
 * GET /api/assessment/:assessmentId/process-status
 * ============================================================
 *
 * Zero Groq calls.
 *
 * Intended for frontend polling.
 */
export function getProcessStatusController(
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

    const status =
      getProcessStatus(
        assessmentId
      );

    res.status(200).json({
      success: true,

      status,
    });
  } catch (
    error
  ) {
    next(error);
  }
}

/**
 * ============================================================
 * GET /api/assessment/:assessmentId/process-dry-run
 * ============================================================
 *
 * Zero Groq calls.
 *
 * Development diagnostic.
 */
export function dryRunProcessController(
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

    const result =
      dryRunAssessmentProcess(
        assessmentId
      );

    res.status(200).json({
      success: true,

      dryRun:
        result,
    });
  } catch (
    error
  ) {
    next(error);
  }
}