export interface EvaluationPromptInput {
  questionNumber: string;

  questionText: string;

  maxMarks: number;

  studentAnswer: string;
}

/**
 * ============================================================
 * EVALUATION PROMPT
 * ============================================================
 *
 * Keep this prompt compact.
 *
 * The API request itself also specifies JSON mode.
 */
export function buildEvaluationPrompt(
  input: EvaluationPromptInput
): string {
  return `
Evaluate the following examination answer.

Question number:
${input.questionNumber}

Question:
${input.questionText}

Maximum marks:
${input.maxMarks}

Student answer:
${input.studentAnswer}

Evaluation requirements:
1. Check correctness.
2. Check completeness.
3. Check relevance.
4. Check technical accuracy.
5. Check all required parts.
6. Award partial marks when justified.
7. Give credit for technically correct content even if grammar is poor.
8. Do not award marks for irrelevant content.
9. Do not invent missing information.
10. Never give more than ${input.maxMarks} marks.

Return ONLY valid JSON.

Required JSON structure:
{
  "score": number,
  "evaluation": "brief explanation",
  "strengths": ["brief item"],
  "weaknesses": ["brief item"],
  "confidence": number
}

Rules:
- score must be between 0 and ${input.maxMarks}.
- confidence must be between 0 and 1.
- evaluation must not be empty.
- strengths and weaknesses must be arrays of strings.
- Do not include reasoning.
- Do not include <think>.
- Do not include markdown.
- Do not include any text before or after the JSON.
`.trim();
}