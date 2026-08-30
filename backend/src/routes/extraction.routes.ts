import { Router } from "express";

import {
  extractQuestionsController,
  extractAnswersController,
  extractAnswerPagesController,
} from "../controllers/extraction.controller";
import {
  resumeAnswerExtractionController,
} from "../controllers/answer-extraction.controller";

import {
  debugAnswerAggregation,
} from "../controllers/extraction-debug.controller";
const router = Router();

import {
  evaluateSingleQuestionController,
} from "../controllers/evaluation.controller";

router.post(
  "/questions/:assessmentId",
  extractQuestionsController
);

router.post(
  "/answers/:assessmentId",
  extractAnswersController
);

router.post(
  "/answers/:assessmentId/resume",
  resumeAnswerExtractionController
);
/**
 * Development/test endpoint.
 *
 * Example:
 * POST /api/extraction/answers/:id/pages?startPage=1&endPage=7
 */
router.post(
  "/answers/:assessmentId/pages",
  extractAnswerPagesController
);
router.get(
  "/debug/answers/:assessmentId",
  debugAnswerAggregation
);

router.post(
  "/evaluation/:assessmentId/:questionId",
  evaluateSingleQuestionController
);

export default router;