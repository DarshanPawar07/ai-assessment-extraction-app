import {
  useMemo,
  useState,
} from "react";

import {
  Sparkles,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import UploadArea from "./components/UploadArea";
import ProgressIndicator from "./components/ProgressIndicator";
import StatsSummary from "./components/StatsSummary";
import QuestionList from "./components/QuestionList";
import SideBySideView from "./components/SideBySideView";

import {
  useAssessment,
} from "./hooks/useAssessment";

type View =
  | "upload"
  | "processing"
  | "result";

function App() {
  const [
    questionPaper,
    setQuestionPaper,
  ] =
    useState<File | null>(
      null
    );

  const [
    answerSheet,
    setAnswerSheet,
  ] =
    useState<File | null>(
      null
    );

  const [
    view,
    setView,
  ] =
    useState<View>(
      "upload"
    );

  const [
    selectedQuestionId,
    setSelectedQuestionId,
  ] =
    useState<
      string | null
    >(null);

  const {
    assessment,
    processStatus,
    result,
    loading,
    processing,
    error,
    upload,
    process,
    stopPolling,
  } =
    useAssessment();

  const selectedQuestion =
    useMemo(
      () =>
        result?.questions.find(
          (
            question
          ) =>
            question.questionId ===
            selectedQuestionId
        ) ??
        result?.questions[0] ??
        null,
      [
        result,
        selectedQuestionId,
      ]
    );

  const canStart =
    Boolean(
      questionPaper &&
        answerSheet
    ) &&
    !loading &&
    !processing;

  const handleCreate =
    async () => {
      if (
        !questionPaper ||
        !answerSheet
      ) {
        return;
      }

      try {
        const created =
          await upload(
            questionPaper,
            answerSheet
          );

        setView(
          "processing"
        );

        await process(
          created.id
        );
      } catch {
        setView(
          "processing"
        );
      }
    };

  const handleViewResults =
    () => {
      if (
        result?.questions
          .length
      ) {
        setSelectedQuestionId(
          result.questions[0]
            .questionId
        );
      }

      setView(
        "result"
      );
    };

  const handleNewAssessment =
    () => {
      stopPolling();

      setQuestionPaper(
        null
      );

      setAnswerSheet(
        null
      );

      setSelectedQuestionId(
        null
      );

      setView(
        "upload"
      );

      window.location.reload();
    };

  const isRateLimited =
    processStatus?.status ===
    "rate_limited";

  const isCompleted =
    processStatus?.evaluationComplete ||
    processStatus?.status ===
      "completed";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles
              size={19}
            />
          </div>

          <div>
            <strong>
              Veda AI
            </strong>

            <span>
              Assessment intelligence
            </span>
          </div>
        </div>

        <div className="topbar-right">
          <div className="secure-label">
            <ShieldCheck
              size={15}
            />
            Secure workspace
          </div>
        </div>
      </header>

      <main className="page">
        {view ===
          "upload" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="hero-badge">
                  <Sparkles
                    size={14}
                  />
                  AI-powered evaluation
                </span>

                <h1>
                  Turn handwritten
                  <br />
                  assessments into
                  <span>
                    insights.
                  </span>
                </h1>

                <p>
                  Veda AI extracts
                  answers, maps them
                  to questions and
                  evaluates each
                  response with
                  structured academic
                  feedback.
                </p>
              </div>

              <div className="hero-orbit">
                <div className="orbit-glow" />

                <div className="orbit-card orbit-card-main">
                  <Sparkles
                    size={24}
                  />

                  <strong>
                    AI Evaluation
                  </strong>

                  <span>
                    Accuracy · Feedback
                    · Insights
                  </span>
                </div>

                <div className="orbit-card orbit-card-small orbit-one">
                  01
                </div>

                <div className="orbit-card orbit-card-small orbit-two">
                  AI
                </div>

                <div className="orbit-card orbit-card-small orbit-three">
                  ✓
                </div>
              </div>
            </section>

            <UploadArea
              questionPaper={
                questionPaper
              }
              answerSheet={
                answerSheet
              }
              onQuestionPaperChange={
                setQuestionPaper
              }
              onAnswerSheetChange={
                setAnswerSheet
              }
              disabled={
                loading ||
                processing
              }
            />

            <div className="create-row">
              <div>
                <span>
                  {questionPaper &&
                  answerSheet
                    ? "Both documents are ready."
                    : "Upload both PDFs to continue."}
                </span>
              </div>

              <button
                type="button"
                className="primary-button"
                disabled={
                  !canStart
                }
                onClick={
                  handleCreate
                }
              >
                {loading ? (
                  <>
                    <span className="button-spinner" />
                    Creating...
                  </>
                ) : (
                  <>
                    Analyze assessment
                    <ArrowRight
                      size={18}
                    />
                  </>
                )}
              </button>
            </div>

            <section className="feature-row">
              <div>
                <strong>
                  Question-aware
                </strong>

                <span>
                  Understands multi-part
                  questions and numbering.
                </span>
              </div>

              <div>
                <strong>
                  Handwriting ready
                </strong>

                <span>
                  Designed around image-based
                  answer extraction.
                </span>
              </div>

              <div>
                <strong>
                  Structured feedback
                </strong>

                <span>
                  Score, reasoning, strengths
                  and weaknesses.
                </span>
              </div>
            </section>
          </>
        )}

        {view ===
          "processing" && (
          <section className="processing-page">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  Assessment{" "}
                  {assessment?.id
                    ? `#${assessment.id.slice(
                        0,
                        8
                      )}`
                    : ""}
                </span>

                <h1>
                  Processing
                  your assessment
                </h1>

                <p>
                  You can stay on this
                  screen while Veda AI
                  handles each stage.
                </p>
              </div>

              <button
                type="button"
                className="ghost-button"
                onClick={
                  handleNewAssessment
                }
              >
                <RotateCcw
                  size={16}
                />
                New assessment
              </button>
            </div>

            <ProgressIndicator
              status={
                processStatus
              }
              error={error}
            />

            {isRateLimited && (
              <div className="notice warning-notice">
                Groq has temporarily
                rate-limited this assessment.
                Your extraction checkpoint is
                preserved, so processing can be
                resumed later.
              </div>
            )}

            {isCompleted &&
              !result && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    handleViewResults
                  }
                >
                  Open results
                  <ArrowRight
                    size={18}
                  />
                </button>
              )}

            {result && (
              <div className="processing-complete">
                <div>
                  <span>
                    Evaluation complete
                  </span>

                  <strong>
                    {result.summary.obtainedMarks}
                    /
                    {
                      result.summary
                        .totalMarks
                    }{" "}
                    marks
                  </strong>
                </div>

                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    handleViewResults
                  }
                >
                  View full results
                  <ArrowRight
                    size={18}
                  />
                </button>
              </div>
            )}
          </section>
        )}

        {view ===
          "result" &&
          result && (
            <section className="result-page">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    Final assessment
                  </span>

                  <h1>
                    Evaluation
                    results
                  </h1>

                  <p>
                    A question-by-question
                    breakdown of the AI
                    evaluation.
                  </p>
                </div>

                <button
                  type="button"
                  className="ghost-button"
                  onClick={
                    handleNewAssessment
                  }
                >
                  <RotateCcw
                    size={16}
                  />
                  New assessment
                </button>
              </div>

              <StatsSummary
                result={result}
              />

              <div className="result-layout">
                <aside className="results-sidebar">
                  <div className="sidebar-title">
                    <div>
                      <span className="eyebrow">
                        Questions
                      </span>

                      <strong>
                        {
                          result.questions
                            .length
                        }{" "}
                        total
                      </strong>
                    </div>

                    <span>
                      {
                        result.summary
                          .percentage
                      }
                      %
                    </span>
                  </div>

                  <QuestionList
                    questions={
                      result.questions
                    }
                    selectedQuestionId={
                      selectedQuestionId ??
                      result.questions[0]
                        ?.questionId ??
                      null
                    }
                    onSelectQuestion={
                      setSelectedQuestionId
                    }
                  />
                </aside>

                <div className="result-main">
                  <SideBySideView
                    question={
                      selectedQuestion
                    }
                  />
                </div>
              </div>
            </section>
          )}

        {!result &&
          view ===
            "result" && (
            <section className="empty-state">
              <h2>
                Results are not
                available yet.
              </h2>
            </section>
          )}
      </main>

      <footer className="footer">
        <span>
          Veda AI
        </span>

        <span>
          Intelligent assessment
          evaluation
        </span>
      </footer>
    </div>
  );
}

export default App;