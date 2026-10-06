import type { Schema } from "./api";
export type Score = Schema["Score"];

export function scoreSide(score: Score | null | undefined) {
  if (!score) return "unknown";
  if (score.kind === "cp" && score.value === 0) return "equal";
  return score.value > 0 || (score.kind === "mate" && score.mate_given)
    ? "white"
    : "black";
}

/** The score to show for a position: a checkmated board has nothing left to
 * search, so it reads M0 for the winner rather than the "mate in 1" of the move
 * that delivered it. Other positions keep their analysis score. */
export function positionScore(score: Score | null | undefined,
  position?: { termination?: string | null; result?: string | null } | null): Score | null {
  if (position?.termination === "checkmate" && (position.result === "1-0" || position.result === "0-1"))
    return { kind: "mate", value: 0, mate_given: position.result === "1-0" };
  return score ?? null;
}

export function scoreText(score: Score | null | undefined, decimals: 1 | 2 = 2) {
  if (!score) return "—";
  const sign = scoreSide(score) === "black" ? "−" : "+";
  const pawns = decimals === 1
    ? Math.round(Math.abs(score.value) / 10) / 10
    : Math.abs(score.value) / 100;
  return score.kind === "mate"
    ? `${sign}M${Math.abs(score.value)}`
    : `${sign}${pawns.toFixed(decimals)}`;
}

export function scoreSummary(score: Score | null | undefined) {
  const side = scoreSide(score);
  if (!score || side === "unknown") return "Not analyzed";
  if (side === "equal") return "Equal";
  const player = side === "white" ? "White" : "Black";
  if (score.kind === "mate")
    return score.value === 0
      ? `${player} checkmates`
      : `${player} mates in ${Math.abs(score.value)}`;
  return `${player} is better`;
}

// The board's compact bar uses a bounded scale; the game graph has its own
// numeric axis. Both keep White's perspective, even when the board is flipped.
export function strength(score: Score) {
  return score.kind === "mate"
    ? scoreSide(score) === "white"
      ? 1
      : -1
    : Math.tanh(score.value / 400);
}
