export interface QuestionGrade {
  questionId: string;

  /**
   * Marks awarded.
   */
  marks: number;

  /**
   * Maximum marks available.
   */
  maxMarks: number;

  /**
   * Optional AI-generated feedback.
   */
  feedback?: string;

  /**
   * Basic evaluation status.
   */
  status?: "correct" | "partially_correct" | "incorrect" | "unanswered";

  /**
   * AI confidence in the grading decision.
   */
  confidence?: number;
}

export interface GradingSummary {
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grades: QuestionGrade[];
  overallFeedback?: string;
}