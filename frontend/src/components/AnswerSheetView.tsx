import {
  FileText,
} from "lucide-react";

interface AnswerSheetViewProps {
  text:
    | string
    | null;
}

export default function AnswerSheetView({
  text,
}: AnswerSheetViewProps) {
  return (
    <div className="answer-panel">
      <div className="answer-panel-header">
        <div>
          <span className="eyebrow">
            Extracted answer
          </span>

          <h3>
            Student response
          </h3>
        </div>

        <FileText
          size={20}
        />
      </div>

      <div className="answer-content">
        {text ? (
          <pre>
            {text}
          </pre>
        ) : (
          <div className="empty-answer">
            No answer available.
          </div>
        )}
      </div>
    </div>
  );
}