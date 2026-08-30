import { Router } from "express";

import {
  createAssessmentController,
  getAssessmentController,
} from "../controllers/assessment.controller";

import { assessmentUpload } from "../middleware/upload.middleware";

const router = Router();

router.post(
  "/",
  assessmentUpload,
  createAssessmentController
);

router.get(
  "/:assessmentId",
  getAssessmentController
);

export default router;