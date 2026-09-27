import { scoreSide, scoreSummary, scoreText, type Score } from "./evaluation";

export default function EvaluationScore({ score }: { score: Score | null | undefined }) {
  return <span className="evaluation-score" data-side={scoreSide(score)}
    aria-label={`Position evaluation for White: ${scoreText(score)}`}
    title={`${scoreSummary(score)}. Scores are from White's perspective.`}>{scoreText(score)}</span>;
}
