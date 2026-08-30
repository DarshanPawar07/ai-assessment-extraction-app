import {
  ChangeEvent,
  DragEvent,
  useRef,
  useState,
} from "react";

import {
  FileText,
  Upload,
  CheckCircle2,
  X,
} from "lucide-react";

interface UploadAreaProps {
  questionPaper:
    | File
    | null;

  answerSheet:
    | File
    | null;

  onQuestionPaperChange: (
    file: File | null
  ) => void;

  onAnswerSheetChange: (
    file: File | null
  ) => void;

  disabled?: boolean;
}

interface FileDropZoneProps {
  title: string;

  description: string;

  file:
    | File
    | null;

  onChange: (
    file: File | null
  ) => void;

  disabled?: boolean;
}

function FileDropZone({
  title,
  description,
  file,
  onChange,
  disabled,
}: FileDropZoneProps) {
  const inputRef =
    useRef<HTMLInputElement>(
      null
    );

  const [
    dragging,
    setDragging,
  ] =
    useState(false);

  const chooseFile = () => {
    if (
      disabled
    ) {
      return;
    }

    inputRef.current?.click();
  };

  const validateFile = (
    selected: File | undefined
  ) => {
    if (
      !selected
    ) {
      return;
    }

    if (
      selected.type !==
      "application/pdf"
    ) {
      return;
    }

    onChange(
      selected
    );
  };

  const handleInputChange =
    (
      event: ChangeEvent<HTMLInputElement>
    ) => {
      validateFile(
        event.target.files?.[0]
      );

      event.target.value =
        "";
    };

  const handleDragOver =
    (
      event: DragEvent<HTMLDivElement>
    ) => {
      event.preventDefault();

      if (
        !disabled
      ) {
        setDragging(
          true
        );
      }
    };

  const handleDragLeave =
    (
      event: DragEvent<HTMLDivElement>
    ) => {
      event.preventDefault();

      setDragging(
        false
      );
    };

  const handleDrop =
    (
      event: DragEvent<HTMLDivElement>
    ) => {
      event.preventDefault();

      setDragging(
        false
      );

      if (
        disabled
      ) {
        return;
      }

      validateFile(
        event.dataTransfer.files?.[0]
      );
    };

  return (
    <div
      className={[
        "upload-card",
        dragging
          ? "upload-card-dragging"
          : "",
        file
          ? "upload-card-selected"
          : "",
        disabled
          ? "upload-card-disabled"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onDragOver={
        handleDragOver
      }
      onDragLeave={
        handleDragLeave
      }
      onDrop={
        handleDrop
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        disabled={disabled}
        onChange={
          handleInputChange
        }
      />

      {!file ? (
        <button
          type="button"
          className="upload-card-button"
          disabled={disabled}
          onClick={
            chooseFile
          }
        >
          <div className="upload-icon">
            <Upload
              size={23}
              strokeWidth={2}
            />
          </div>

          <div className="upload-copy">
            <strong>
              {title}
            </strong>

            <span>
              {description}
            </span>

            <small>
              PDF only
            </small>
          </div>
        </button>
      ) : (
        <div className="selected-file">
          <div className="selected-file-icon">
            <FileText
              size={23}
            />
          </div>

          <div className="selected-file-copy">
            <strong>
              {file.name}
            </strong>

            <span>
              {(
                file.size /
                1024 /
                1024
              ).toFixed(2)}{" "}
              MB
            </span>
          </div>

          <CheckCircle2
            className="selected-success"
            size={21}
          />

          <button
            type="button"
            className="remove-file"
            disabled={disabled}
            onClick={() =>
              onChange(
                null
              )
            }
            aria-label="Remove file"
          >
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function UploadArea({
  questionPaper,
  answerSheet,
  onQuestionPaperChange,
  onAnswerSheetChange,
  disabled,
}: UploadAreaProps) {
  return (
    <section className="upload-section">
      <div className="upload-section-header">
        <div>
          <span className="eyebrow">
            Start an assessment
          </span>

          <h2>
            Bring your papers.
            <br />
            We’ll handle the rest.
          </h2>
        </div>

        <p>
          Upload the question paper
          and student's answer sheet.
          Veda AI will extract,
          map, evaluate and summarize
          the assessment automatically.
        </p>
      </div>

      <div className="upload-grid">
        <FileDropZone
          title="Question paper"
          description="Drop the original exam paper here"
          file={
            questionPaper
          }
          onChange={
            onQuestionPaperChange
          }
          disabled={
            disabled
          }
        />

        <FileDropZone
          title="Student answer sheet"
          description="Drop the handwritten answers here"
          file={
            answerSheet
          }
          onChange={
            onAnswerSheetChange
          }
          disabled={
            disabled
          }
        />
      </div>
    </section>
  );
}