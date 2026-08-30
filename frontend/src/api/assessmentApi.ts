import {
  Assessment,
  AssessmentResult,
  ProcessStatus,
} from "../types";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

async function parseResponse<T>(
  response: Response
): Promise<T> {
  let data: unknown;

  try {
    data =
      await response.json();
  } catch {
    throw new Error(
      `Server returned HTTP ${response.status}.`
    );
  }

  if (
    !response.ok
  ) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (
        data as {
          message?: unknown;
        }
      ).message === "string"
        ? (
            data as {
              message: string;
            }
          ).message
        : `Request failed with HTTP ${response.status}.`;

    throw new Error(
      message
    );
  }

  return data as T;
}

/**
 * Create assessment and upload both PDFs.
 */
export async function createAssessment(
  questionPaper: File,
  answerSheet: File
): Promise<Assessment> {
  const formData =
    new FormData();

  formData.append(
    "questionPaper",
    questionPaper
  );

  formData.append(
    "answerSheet",
    answerSheet
  );

  const response =
    await fetch(
      `${API_BASE}/assessment`,
      {
        method: "POST",
        body: formData,
      }
    );

  const data =
    await parseResponse<{
      success: boolean;
      message?: string;
      assessment: Assessment;
    }>(
      response
    );

  return data.assessment;
}

/**
 * Start/resume the asynchronous assessment pipeline.
 */
export async function startAssessmentProcessing(
  assessmentId: string
): Promise<{
  message: string;
  assessmentId: string;
  status: string;
}> {
  const response =
    await fetch(
      `${API_BASE}/assessment/${assessmentId}/process`,
      {
        method: "POST",
      }
    );

  return parseResponse(
    response
  );
}

/**
 * Get processing status.
 *
 * No Groq call.
 */
export async function getProcessStatus(
  assessmentId: string
): Promise<ProcessStatus> {
  const response =
    await fetch(
      `${API_BASE}/assessment/${assessmentId}/process-status`
    );

  const data =
    await parseResponse<{
      success: boolean;
      status: ProcessStatus;
    }>(
      response
    );

  return data.status;
}

/**
 * Get complete frontend-ready result.
 *
 * No Groq call.
 */
export async function getAssessmentResult(
  assessmentId: string
): Promise<AssessmentResult> {
  const response =
    await fetch(
      `${API_BASE}/evaluation/${assessmentId}/result`
    );

  const data =
    await parseResponse<{
      success: boolean;
      result: AssessmentResult;
    }>(
      response
    );

  return data.result;
}

/**
 * Get raw assessment.
 *
 * Useful for review/debugging.
 */
export async function getAssessment(
  assessmentId: string
): Promise<Assessment> {
  const response =
    await fetch(
      `${API_BASE}/assessment/${assessmentId}`
    );

  const data =
    await parseResponse<{
      success: boolean;
      assessment: Assessment;
    }>(
      response
    );

  return data.assessment;
}