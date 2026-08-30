import {
  Router,
} from "express";

import {
  evaluateAssessmentController,
  evaluateSingleQuestionController,
  getEvaluationController,
  getEvaluationSummaryController,
  getAssessmentResultController,
} from "../controllers/evaluation.controller";

const router =
  Router();

/**
 * Full assessment evaluation.
 */
router.post(
  "/:assessmentId",
  evaluateAssessmentController
);

/**
 * Single question evaluation.
 */
router.post(
  "/:assessmentId/:questionId",
  evaluateSingleQuestionController
);

/**
 * Evaluation summary.
 *
 * ZERO GROQ CALLS.
 */
router.get(
  "/:assessmentId/summary",
  getEvaluationSummaryController
);

/**
 * Frontend-ready result.
 *
 * ZERO GROQ CALLS.
 */
router.get(
  "/:assessmentId/result",
  getAssessmentResultController
);

/**
 * Raw evaluation results.
 *
 * ZERO GROQ CALLS.
 */
router.get(
  "/:assessmentId",
  getEvaluationController
);

export default router;