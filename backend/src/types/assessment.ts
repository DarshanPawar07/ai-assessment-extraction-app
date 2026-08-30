import {
  Question,
} from "./question";

import {
  Answer,
} from "./answer";

import {
  AnswerMapping,
} from "./mapping";

import {
  DocumentFile,
} from "./document";
import {
  EvaluationResult,
  AssessmentEvaluationSummary,
} from "./evaluation";

export type AssessmentStatus =
  | "created"
  | "processing"
  | "extracting_questions"
  | "extracting_answers"
  | "mapping_answers"
  | "evaluating"
  | "completed"
  | "failed"
  | "rate_limited";

export interface AssessmentProgress {
  currentStep: string;

  progress: number;

  message: string;
}

export interface AssessmentExtractionState {
  completedPages: number[];

  nextPage: number;

  totalPages: number;

  lastCompletedPage?: number;

  lastError?: string;

  updatedAt: string;
}

export interface Assessment {
  id: string;

  status: AssessmentStatus;

  progress: AssessmentProgress;

  questionPaper: DocumentFile;

  answerSheet: DocumentFile;

  questions: Question[];

  answers: Answer[];

  mappings: AnswerMapping[];
    evaluations: EvaluationResult[];

  evaluationSummary?: AssessmentEvaluationSummary;

  answerExtraction?: AssessmentExtractionState;

  error?: string;

  createdAt: string;

  updatedAt: string;
}