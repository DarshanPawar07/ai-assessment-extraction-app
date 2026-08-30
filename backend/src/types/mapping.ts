export type MappingStatus =
  | "matched"
  | "unanswered"
  | "unmatched"
  | "ambiguous";

export type MappingMatchType =
  | "exact_label"
  | "label_and_semantic"
  | "semantic"
  | "contextual"
  | "ambiguous"
  | "unmatched";

export interface AnswerMapping {
  /**
   * Unique mapping ID.
   */
  id: string;

  /**
   * Canonical question ID from the question paper.
   *
   * null when this is an unmatched/ambiguous answer.
   */
  questionId: string | null;

  /**
   * Canonical question number.
   */
  questionNumber: string | null;

  /**
   * Extracted answer ID.
   *
   * null when a question is unanswered.
   */
  answerId: string | null;

  /**
   * Mapping state.
   */
  status: MappingStatus;

  /**
   * How the mapping was established.
   */
  matchType: MappingMatchType;

  /**
   * Confidence from 0 to 1.
   */
  confidence: number;

  /**
   * Human-readable explanation.
   */
  reason: string;

  /**
   * Candidate question IDs for ambiguous mappings.
   */
  candidateQuestionIds: string[];
}