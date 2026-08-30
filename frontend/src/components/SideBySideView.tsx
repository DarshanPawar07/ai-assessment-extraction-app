import {
  QuestionResult,
} from "../types";

import AnswerSheetView from "./AnswerSheetView";

interface SideBySideViewProps {
  question:
    | QuestionResult
    | null;
}

export default function SideBySideView({
  question,
}: SideBySideViewProps) {
  if (
    !question
  ) {
    return (
      <div className="side-empty">
        Select a question to
        inspect the evaluation.
      </div>
    );
  }

  return (
    <div className="side-by-side">
      <div className="question-panel">
        <div className="question-panel-header">
          <span className="question-pill">
            {
              question.questionNumber
            }
          </span>

          <span className="marks-pill">
            {question.maxMarks} marks
          </span>
        </div>

        <h3>
          {
            question.questionText
          }
        </h3>

        <div className="question-panel-divider" />

        <span className="eyebrow">
          AI evaluation
        </span>

        <p className="evaluation-text">
          {question.evaluation}
        </p>

        <div className="feedback-grid">
          <div>
            <span className="feedback-title">
              Strengths
            </span>

            {question.strengths.length >
            0 ? (
              <ul>
                {question.strengths.map(
                  (
                    item
                  ) => (
                    <li
                      key={
                        item
                      }
                    >
                      {item}
                    </li>
                  )
                )}
              </ul>
            ) : (
              <span className="muted">
                No strengths recorded.
              </span>
            )}
          </div>

          <div>
            <span className="feedback-title">
              Areas to improve
            </span>

            {question.weaknesses.length >
            0 ? (
              <ul>
                {question.weaknesses.map(
                  (
                    item
                  ) => (
                    <li
                      key={
                        item
                      }
                    >
                      {item}
                    </li>
                  )
                )}
              </ul>
            ) : (
              <span className="muted">
                No weaknesses recorded.
              </span>
            )}
          </div>
        </div>
      </div>

      <AnswerSheetView
        text={
          question.answerText
        }
      />
    </div>
  );
}