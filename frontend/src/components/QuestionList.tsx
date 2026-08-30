import {
  CheckCircle2,
  MinusCircle,
} from "lucide-react";

import {
  QuestionResult,
} from "../types";

interface QuestionListProps {
  questions:
    QuestionResult[];

  selectedQuestionId:
    | string
    | null;

  onSelectQuestion: (
    questionId: string
  ) => void;
}

export default function QuestionList({
  questions,
  selectedQuestionId,
  onSelectQuestion,
}: QuestionListProps) {
  return (
    <div className="question-list">
      {questions.map(
        (
          question
        ) => {
          const answered =
            Boolean(
              question.answerId
            );

          const selected =
            question.questionId ===
            selectedQuestionId;

          return (
            <button
              type="button"
              className={[
                "question-item",
                selected
                  ? "question-selected"
                  : "",
              ]
                .filter(
                  Boolean
                )
                .join(" ")}
              key={
                question.questionId
              }
              onClick={() =>
                onSelectQuestion(
                  question.questionId
                )
              }
            >
              <div className="question-number">
                {
                  question.questionNumber
                }
              </div>

              <div className="question-copy">
                <strong>
                  {
                    question.questionText
                  }
                </strong>

                <span>
                  {question.score} /{" "}
                  {
                    question.maxMarks
                  }{" "}
                  marks
                </span>
              </div>

              {answered ? (
                <CheckCircle2
                  size={18}
                  className="question-success"
                />
              ) : (
                <MinusCircle
                  size={18}
                  className="question-muted"
                />
              )}
            </button>
          );
        }
      )}
    </div>
  );
}