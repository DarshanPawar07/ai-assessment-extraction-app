import { BoundingBox } from "./document";

export interface Question {
  id: string;

  /**
   * Original printed question number.
   * Examples: "1", "3(a)", "11(b)"
   */
  number: string;

  /**
   * Question text extracted from the question paper.
   */
  text: string;

  /**
   * Page where the question appears.
   */
  page: number;

  /**
   * Exact location of the question on the page.
   */
  bbox: BoundingBox;

  /**
   * Optional parent question number.
   * Example:
   * 3(a) → parentNumber = "3"
   */
  parentNumber?: string;

  /**
   * Whether this is a labelled sub-part.
   */
  isSubPart: boolean;

  /**
   * Original ordering in the question paper.
   */
  order: number;

  /**
   * Maximum marks if they can be extracted.
   */
  maxMarks?: number;
}