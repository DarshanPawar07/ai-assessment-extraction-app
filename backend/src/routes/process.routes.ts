import {
  Router,
} from "express";

import {
  startAssessmentProcessController,
  getProcessStatusController,
  dryRunProcessController,
} from "../controllers/process.controller";

const router =
  Router();

/**
 * ============================================================
 * POST /api/assessment/:assessmentId/process
 * ============================================================
 *
 * Start/resume assessment processing.
 *
 * Returns immediately.
 */
router.post(
  "/:assessmentId/process",
  startAssessmentProcessController
);

/**
 * ============================================================
 * GET /api/assessment/:assessmentId/process-status
 * ============================================================
 *
 * Check processing state.
 */
router.get(
  "/:assessmentId/process-status",
  getProcessStatusController
);

/**
 * ============================================================
 * GET /api/assessment/:assessmentId/process-dry-run
 * ============================================================
 *
 * Development-only diagnostic.
 */
router.get(
  "/:assessmentId/process-dry-run",
  dryRunProcessController
);

export default router;