import { BoundingBox } from "./document";

export interface AnswerRegion {
  page: number;
  bbox: BoundingBox;
}

export interface Answer {
  /**
   * Unique internal answer ID.
   */
  id: string;

  /**
   * Transcribed answer text.
   */
  text: string;

  /**
   * Canonical question-paper identifier when
   * the extractor can confidently determine it.
   *
   * Example:
   * "1(a)"
   */
  explicitQuestionNumber?: string;

  /**
   * The question label actually visible on the
   * answer sheet.
   *
   * Examples:
   * "Q.1(a)"
   * "1(a)"
   * "b)"
   * "3)"
   *
   * We preserve the student's original label.
   */
  studentQuestionNumber?: string;

  /**
   * Canonical question that this answer continues.
   *
   * Example:
   * Page 2 -> 1(a)
   * Page 3 -> continuationOf = "1(a)"
   */
  continuationOf?: string;

  /**
   * Physical answer regions.
   *
   * A multi-page answer can have multiple regions.
   */
  regions: AnswerRegion[];

  /**
   * Physical extraction order.
   */
  order: number;

  /**
   * AI extraction confidence.
   */
  extractionConfidence?: number;
}