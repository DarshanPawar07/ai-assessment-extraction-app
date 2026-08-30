import { Request, Response, NextFunction } from "express";

import {
  createAssessment,
  getAssessmentById,
} from "../services/assessment.service";

export async function createAssessmentController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const files = req.files as {
      questionPaper?: Express.Multer.File[];
      answerSheet?: Express.Multer.File[];
    };

    const questionPaper = files?.questionPaper?.[0];

    const answerSheet = files?.answerSheet?.[0];

    if (!questionPaper) {
      res.status(400).json({
        success: false,
        message: "Question paper is required.",
      });

      return;
    }

    if (!answerSheet) {
      res.status(400).json({
        success: false,
        message: "Student answer sheet is required.",
      });

      return;
    }

    const assessment = await createAssessment(
      questionPaper,
      answerSheet
    );

    res.status(201).json({
      success: true,
      message: "Assessment created successfully.",
      assessment: {
        id: assessment.id,
        status: assessment.status,
progress: assessment.progress,

        questionPaper: {
          name: assessment.questionPaper.originalName,
          mimeType: assessment.questionPaper.mimeType,
          pageCount: assessment.questionPaper.pageCount,
          pages: assessment.questionPaper.pages,
        },

        answerSheet: {
          name: assessment.answerSheet.originalName,
          mimeType: assessment.answerSheet.mimeType,
          pageCount: assessment.answerSheet.pageCount,
          pages: assessment.answerSheet.pages,
        },

        createdAt: assessment.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export function getAssessmentController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { assessmentId } = req.params;

    if (typeof assessmentId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid assessment ID.",
      });

      return;
    }

    const assessment = getAssessmentById(assessmentId);

    if (!assessment) {
      res.status(404).json({
        success: false,
        message: "Assessment not found.",
      });

      return;
    }

    res.status(200).json({
      success: true,
      assessment,
    });
  } catch (error) {
    next(error);
  }
}