import {
  Check,
  CircleDot,
  LoaderCircle,
  AlertTriangle,
} from "lucide-react";

import {
  ProcessStatus,
} from "../types";

interface ProgressIndicatorProps {
  status:
    | ProcessStatus
    | null;

  error:
    | string
    | null;
}

const stages = [
  {
    key:
      "questions",
    label:
      "Question extraction",
  },
  {
    key:
      "answers",
    label:
      "Answer extraction",
  },
  {
    key:
      "mapping",
    label:
      "Answer mapping",
  },
  {
    key:
      "evaluation",
    label:
      "AI evaluation",
  },
];

export default function ProgressIndicator({
  status,
  error,
}: ProgressIndicatorProps) {
  const getStageState =
    (
      key: string
    ) => {
      if (
        !status
      ) {
        return "pending";
      }

      if (
        key ===
        "questions"
      ) {
        return status.questionsComplete
          ? "complete"
          : status.currentStep.includes(
                "question"
              )
            ? "active"
            : "pending";
      }

      if (
        key ===
        "answers"
      ) {
        return status.answersComplete
          ? "complete"
          : status.currentStep.includes(
                "answer"
              )
            ? "active"
            : "pending";
      }

      if (
        key ===
        "mapping"
      ) {
        return status.mappingComplete
          ? "complete"
          : status.currentStep.includes(
                "mapping"
              )
            ? "active"
            : "pending";
      }

      return status.evaluationComplete
        ? "complete"
        : status.currentStep.includes(
              "evaluat"
            )
          ? "active"
          : "pending";
    };

  return (
    <section className="processing-card">
      <div className="processing-header">
        <div>
          <span className="eyebrow">
            AI processing
          </span>

          <h2>
            Your assessment is
            being analyzed
          </h2>
        </div>

        <div className="processing-percent">
          {status?.progress ?? 0}%
        </div>
      </div>

      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${
              status?.progress ??
              0
            }%`,
          }}
        />
      </div>

      <div className="processing-message">
        {error ? (
          <>
            <AlertTriangle
              size={17}
            />

            <span>
              {error}
            </span>
          </>
        ) : (
          <>
            <LoaderCircle
              size={17}
              className="spin"
            />

            <span>
              {status?.currentStep ??
                "Preparing processing..."}
              {" — "}
               {status?.progress ?? 0}
        %
            </span>
          </>
        )}
      </div>

      <div className="stage-list">
        {stages.map(
          (
            stage
          ) => {
            const state =
              getStageState(
                stage.key
              );

            return (
              <div
                className={`stage-row stage-${state}`}
                key={
                  stage.key
                }
              >
                <div className="stage-icon">
                  {state ===
                  "complete" ? (
                    <Check
                      size={16}
                    />
                  ) : state ===
                    "active" ? (
                    <CircleDot
                      size={16}
                    />
                  ) : (
                    <span />
                  )}
                </div>

                <span>
                  {stage.label}
                </span>

                {state ===
                  "active" && (
                  <LoaderCircle
                    size={15}
                    className="stage-spinner spin"
                  />
                )}
              </div>
            );
          }
        )}
      </div>

      {status &&
        !status.answersComplete &&
        status.totalAnswerPages > 0 && (
          <div className="page-progress">
            <span>
              Answer pages
            </span>

            <strong>
              {
                status.completedAnswerPages
              }{" "}
              /{" "}
              {
                status.totalAnswerPages
              }
            </strong>
          </div>
        )}
    </section>
  );
}