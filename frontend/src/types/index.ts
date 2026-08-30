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

export interface DocumentPage {
  pageNumber: number;
  width: number;
  height: number;
  imagePath?: string;
}

export interface DocumentFile {
  id?: string;
  name?: string;
  originalName?: string;
  mimeType: string;
  path?: string;
  pageCount: number;
  pages: DocumentPage[];
}

export interface Question {
  id: string;
  number: string;
  text: string;
  page: number;

  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  parentNumber?: string;
  isSubPart?: boolean;
  order: number;
  maxMarks?: number;
}

export interface Answer {
  id: string;
  text: string;

  studentQuestionNumber?: string;
  explicitQuestionNumber?: string;
  continuationOf?: string;

  regions?: Array<{
    page: number;
    bbox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;

  order: number;
  extractionConfidence?: number;
}

export interface AnswerMapping {
  id: string;
  questionId: string;
  questionNumber: string;
  answerId: string | null;
  status:
    | "matched"
    | "unanswered"
    | "ambiguous"
    | "unmatched";
  matchType: string;
  confidence: number;
  reason: string;
  candidateQuestionIds: string[];
}

export interface EvaluationResult {
  id: string;

  assessmentId: string;

  questionId: string;

  questionNumber: string;

  answerId: string;

  maxMarks: number;

  score: number;

  percentage: number;

  evaluation: string;

  strengths: string[];

  weaknesses: string[];

  confidence: number;

  createdAt: string;
}

export interface AssessmentEvaluationSummary {
  totalQuestions: number;
  evaluatedQuestions: number;
  unansweredQuestions: number;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
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

  error?: string;

  createdAt: string;

  updatedAt: string;
}

export interface ProcessStatus {
  assessmentId: string;

  questionsComplete: boolean;

  answersComplete: boolean;

  mappingComplete: boolean;

  evaluationComplete: boolean;

  completedAnswerPages: number;

  totalAnswerPages: number;

  nextAnswerPage?: number;

  currentStep: string;

  progress: number;

  status: string;
}

export interface QuestionResult {
  questionId: string;

  questionNumber: string;

  questionText: string;

  maxMarks: number;

  answerId: string | null;

  answerText: string | null;

  mappingStatus: string | null;

  mappingConfidence: number | null;

  score: number;

  percentage: number;

  evaluation: string;

  strengths: string[];

  weaknesses: string[];

  evaluationConfidence: number | null;
}

export interface AssessmentResult {
  assessmentId: string;

  status: string;

  progress: AssessmentProgress;

  summary: AssessmentEvaluationSummary;

  questions: QuestionResult[];

  createdAt: string;

  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  assessment?: T;
  result?: T;
  status?: T;
}