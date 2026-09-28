import type { Schema } from "./api";
export type Score = Schema["Score"];

export function scoreSide(score: Score | null | undefined) {
  if (!score) return "unknown";
  if (score.kind === "cp" && score.value === 0) return "equal";
  return score.value > 0 || (score.kind === "mate" && score.mate_given)
    ? "white"
    : "black";
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
