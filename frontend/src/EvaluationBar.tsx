import { scoreText, strength, type Score } from "./evaluation";

/** The board's evaluation bar: White's share of the position, one decimal, filled
 * from the side of the board White sits on. */
export default function EvaluationBar({ score, orientation }: { score: Score | null; orientation: "white" | "black" }) {
  return (
    <div className="game-eval-bar" aria-label={`Evaluation for White: ${scoreText(score, 1)}`}>
      <div
        style={{
          height: `${score ? 50 + 48 * strength(score) : 50}%`,
          top: orientation === "black" ? 0 : "auto",
          bottom: orientation === "white" ? 0 : "auto",
        }}
      />
      <span>{scoreText(score, 1)}</span>
    </div>
  );
}
