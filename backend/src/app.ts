import express from "express";
import cors from "cors";

import assessmentRoutes from "./routes/assessment.routes";
import extractionRoutes from "./routes/extraction.routes";
import mappingRoutes from "./routes/mapping.routes";
import processRoutes from "./routes/process.routes";
import evaluationRoutes from "./routes/evaluation.routes";

import { errorMiddleware } from "./middleware/error.middleware";

const app = express();

/**
 * ============================================================
 * CORS
 * ============================================================
 */

app.use(
  cors({
    origin: "http://localhost:3000",
  })
);

/**
 * ============================================================
 * BODY PARSER
 * ============================================================
 */

app.use(express.json());

/**
 * ============================================================
 * HEALTH CHECK
 * ============================================================
 */

app.get(
  "/api/health",
  (_req, res) => {
    res.status(200).json({
      success: true,
      message:
        "AI Assessment Backend is running",
    });
  }
);

/**
 * ============================================================
 * ASSESSMENT APIs
 * ============================================================
 *
 * POST /api/assessment
 * GET  /api/assessment/:assessmentId
 */

app.use(
  "/api/assessment",
  assessmentRoutes
);

/**
 * ============================================================
 * PROCESS APIs
 * ============================================================
 *
 * POST /api/assessment/:assessmentId/process
 * GET  /api/assessment/:assessmentId/process-status
 * GET  /api/assessment/:assessmentId/process-dry-run
 */

app.use(
  "/api/assessment",
  processRoutes
);

/**
 * ============================================================
 * EXTRACTION APIs
 * ============================================================
 *
 * POST /api/extraction/questions/:assessmentId
 * POST /api/extraction/answers/:assessmentId
 * POST /api/extraction/answers/:assessmentId/pages
 */

app.use(
  "/api/extraction",
  extractionRoutes
);

/**
 * ============================================================
 * MAPPING APIs
 * ============================================================
 *
 * POST /api/extraction/mapping/:assessmentId
 */

app.use(
  "/api/extraction",
  mappingRoutes
);

/**
 * ============================================================
 * EVALUATION APIs
 * ============================================================
 *
 * POST /api/evaluation/:assessmentId
 * POST /api/evaluation/:assessmentId/:questionId
 * GET  /api/evaluation/:assessmentId
 * GET  /api/evaluation/:assessmentId/summary
 * GET  /api/evaluation/:assessmentId/result
 */

app.use(
  "/api/evaluation",
  evaluationRoutes
);

/**
 * ============================================================
 * GLOBAL ERROR HANDLER
 * ============================================================
 *
 * MUST remain last.
 */

app.use(
  errorMiddleware
);

export default app;