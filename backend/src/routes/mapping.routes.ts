// TODO: Implement backend/src/routes/mapping.routes.ts
import { Router } from "express";

import {
  mapAssessmentController,
} from "../controllers/mapping.controller";

const router =
  Router();

/**
 * Map extracted answers to the
 * canonical question paper questions.
 *
 * POST /api/extraction/mapping/:assessmentId
 */
router.post(
  "/mapping/:assessmentId",
  mapAssessmentController
);

export default router;