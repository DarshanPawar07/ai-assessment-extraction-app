const STORAGE_KEY =
  "veda-ai-current-assessment";

export function saveAssessmentId(
  assessmentId: string
): void {
  localStorage.setItem(
    STORAGE_KEY,
    assessmentId
  );
}

export function getSavedAssessmentId():
  string | null {
  return localStorage.getItem(
    STORAGE_KEY
  );
}

export function clearSavedAssessmentId():
  void {
  localStorage.removeItem(
    STORAGE_KEY
  );
}