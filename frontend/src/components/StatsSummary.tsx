import {
  Brain,
  FileCheck2,
  CircleX,
  Trophy,
} from "lucide-react";

import {
  AssessmentResult,
} from "../types";

interface StatsSummaryProps {
  result: AssessmentResult;
}

export default function StatsSummary({
  result,
}: StatsSummaryProps) {
  const {
    summary,
  } =
    result;

  const stats = [
    {
      label:
        "Score",
      value:
        `${summary.obtainedMarks}/${summary.totalMarks}`,
      icon:
        Trophy,
      accent:
        "indigo",
    },
    {
      label:
        "Percentage",
      value:
        `${summary.percentage}%`,
      icon:
        Brain,
      accent:
        "violet",
    },
    {
      label:
        "Evaluated",
      value:
        String(
          summary.evaluatedQuestions
        ),
      icon:
        FileCheck2,
      accent:
        "green",
    },
    {
      label:
        "Unanswered",
      value:
        String(
          summary.unansweredQuestions
        ),
      icon:
        CircleX,
      accent:
        "orange",
    },
  ];

  return (
    <div className="stats-grid">
      {stats.map(
        ({
          label,
          value,
          icon: Icon,
          accent,
        }) => (
          <div
            className="stat-card"
            key={label}
          >
            <div
              className={`stat-icon stat-${accent}`}
            >
              <Icon
                size={20}
              />
            </div>

            <div>
              <span>
                {label}
              </span>

              <strong>
                {value}
              </strong>
            </div>
          </div>
        )
      )}
    </div>
  );
}