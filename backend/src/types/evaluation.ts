export interface EvaluationResult {
  id: string;

  assessmentId: string;

  questionId: string;

  questionNumber: string;

  answerId?: string;

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

export interface EvaluationResponse {
  results: EvaluationResult[];

  summary: AssessmentEvaluationSummary;
}