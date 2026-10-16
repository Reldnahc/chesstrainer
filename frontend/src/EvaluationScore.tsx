import { scoreSide, scoreSummary, scoreText, type Score } from "./evaluation";

/** size="compact" is the smaller reading beside the evaluation graph. */
export default function EvaluationScore({ score, size = "ordinary" }: { score: Score | null | undefined; size?: "ordinary" | "compact" }) {
  return <span className={size === "compact" ? "evaluation-score evaluation-score--compact" : "evaluation-score"} data-side={scoreSide(score)}
    aria-label={`Position evaluation for White: ${scoreText(score)}`}
    title={`${scoreSummary(score)}. Scores are from White's perspective.`}>{scoreText(score)}</span>;
}
