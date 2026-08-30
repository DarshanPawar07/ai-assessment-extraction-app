// TODO: Implement frontend/hooks/useAssessment.ts
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createAssessment,
  getAssessmentResult,
  getProcessStatus,
  startAssessmentProcessing,
} from "../api/assessmentApi";

import {
  Assessment,
  AssessmentResult,
  ProcessStatus,
} from "../types";

import {
  saveAssessmentId,
} from "../stores/assessmentStore";

const POLL_INTERVAL = 2500;

interface UseAssessmentState {
  assessment: Assessment | null;

  processStatus:
    | ProcessStatus
    | null;

  result:
    | AssessmentResult
    | null;

  loading: boolean;

  processing: boolean;

  error: string | null;
}

export function useAssessment() {
  const [
    state,
    setState,
  ] =
    useState<UseAssessmentState>({
      assessment:
        null,

      processStatus:
        null,

      result:
        null,

      loading:
        false,

      processing:
        false,

      error:
        null,
    });

  const pollRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const stopPolling =
    useCallback(
      () => {
        if (
          pollRef.current
        ) {
          clearTimeout(
            pollRef.current
          );

          pollRef.current =
            null;
        }
      },
      []
    );

  useEffect(
    () => {
      return () => {
        stopPolling();
      };
    },
    [
      stopPolling,
    ]
  );

  const upload =
    useCallback(
      async (
        questionPaper: File,
        answerSheet: File
      ) => {
        setState(
          {
            assessment:
              null,

            processStatus:
              null,

            result:
              null,

            loading:
              true,

            processing:
              false,

            error:
              null,
          }
        );

        try {
          const assessment =
            await createAssessment(
              questionPaper,
              answerSheet
            );

          saveAssessmentId(
            assessment.id
          );

          setState(
            (
              previous
            ) => ({
              ...previous,

              assessment,

              loading:
                false,
            })
          );

          return assessment;
        } catch (
          error
        ) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to create assessment.";

          setState(
            (
              previous
            ) => ({
              ...previous,

              loading:
                false,

              error:
                message,
            })
          );

          throw error;
        }
      },
      []
    );

  const refreshStatus =
    useCallback(
      async (
        assessmentId: string
      ) => {
        const status =
          await getProcessStatus(
            assessmentId
          );

        setState(
          (
            previous
          ) => ({
            ...previous,

            processStatus:
              status,
          })
        );

        return status;
      },
      []
    );

  const loadResult =
    useCallback(
      async (
        assessmentId: string
      ) => {
        const result =
          await getAssessmentResult(
            assessmentId
          );

        setState(
          (
            previous
          ) => ({
            ...previous,

            result,
          })
        );

        return result;
      },
      []
    );

  const process =
    useCallback(
      async (
        assessmentId: string
      ) => {
        stopPolling();

        setState(
          (
            previous
          ) => ({
            ...previous,

            processing:
              true,

            error:
              null,
          })
        );

        try {
          await startAssessmentProcessing(
            assessmentId
          );

          /**
           * Poll until processing finishes.
           */
          const poll =
            async (): Promise<void> => {
              try {
                const status =
                  await getProcessStatus(
                    assessmentId
                  );

                setState(
                  (
                    previous
                  ) => ({
                    ...previous,

                    processStatus:
                      status,
                  })
                );

                const normalizedStatus =
                  status.status.toLowerCase();

                if (
                  normalizedStatus ===
                    "completed" ||
                  status.evaluationComplete
                ) {
                  const result =
                    await loadResult(
                      assessmentId
                    );

                  setState(
                    (
                      previous
                    ) => ({
                      ...previous,

                      processing:
                        false,

                      result,
                    })
                  );

                  return;
                }

                /**
                 * Stop polling on a permanent failure.
                 *
                 * Rate limited is also stopped because
                 * immediately polling it would repeatedly
                 * hit Groq.
                 */
                if (
                  normalizedStatus ===
                    "failed" ||
                  normalizedStatus ===
                    "rate_limited"
                ) {
                  setState(
                    (
                      previous
                    ) => ({
                      ...previous,

                      processing:
                        false,

                      error:
                        status.status ===
                        "rate_limited"
                          ? "AI processing is temporarily rate-limited. You can resume processing later."
                          : "Assessment processing failed.",
                    })
                  );

                  return;
                }

                pollRef.current =
                  setTimeout(
                    poll,
                    POLL_INTERVAL
                  );
              } catch (
                error
              ) {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Failed to check processing status.";

                setState(
                  (
                    previous
                  ) => ({
                    ...previous,

                    processing:
                      false,

                    error:
                      message,
                  })
                );
              }
            };

          await poll();
        } catch (
          error
        ) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to start assessment processing.";

          setState(
            (
              previous
            ) => ({
              ...previous,

              processing:
                false,

              error:
                message,
            })
          );

          throw error;
        }
      },
      [
        loadResult,
        stopPolling,
      ]
    );

  return {
    ...state,

    upload,

    process,

    refreshStatus,

    loadResult,

    stopPolling,
  };
}