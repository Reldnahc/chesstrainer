import type { Schema } from "./api";
export type Score = Schema["Score"];
type Side = "white" | "black";

export function scoreSide(score: Score | null | undefined) {
  if (!score) return "unknown";
  if (score.kind === "cp" && score.value === 0) return "equal";
  return score.value > 0 || (score.kind === "mate" && score.mate_given)
    ? "white"
    : "black";
}

/** A score from the other side's view. A delivered mate (M0) keeps its winner
 * by flipping `mate_given` along with the sign. */
export function negateScore(score: Score): Score {
  return score.kind === "mate" && score.value === 0
    ? { ...score, mate_given: !score.mate_given }
    : { ...score, value: -score.value };
}

type ScoredPosition = {
  termination?: string | null; result?: string | null;
  /** The side that played the move into this position. */
  actor?: Side | null;
  /** The side to move in this position. */
  turn?: Side | null;
};

/** The score to show for a position.
 *
 * A reviewed move's saved score (`white_score`) is the played move's root search
 * score from before the move. A forced mate there counts the move just played,
 * so when the mover is the side mating, the board is one move closer: mate N
 * before the move is mate N−1 after it, and a delivered mate reads M0 for the
 * winner. When the mover is being mated, the count is already the mating side's
 * moves from this position and stays. Pass `source: "position"` for a score
 * searched from the position itself (a variation's own search, the start).
 *
 * A board the rules have ended reads its result: checkmate is M0 for the winner,
 * and a draw (stalemate, insufficient material, repetition) is equal. */
export function positionScore(score: Score | null | undefined,
  position?: ScoredPosition | null, source: "move" | "position" = "move"): Score | null {
  if (position?.termination === "checkmate" && (position.result === "1-0" || position.result === "0-1"))
    return { kind: "mate", value: 0, mate_given: position.result === "1-0" };
  if (position?.termination && position.result === "1/2-1/2")
    return { kind: "cp", value: 0, mate_given: false };
  if (!score) return null;
  const mover = position?.actor ?? (position?.turn ? (position.turn === "white" ? "black" : "white") : null);
  if (source === "position" || score.kind !== "mate" || score.value === 0 || !mover
    || (score.value > 0) !== (mover === "white")) return score;
  const value = score.value - Math.sign(score.value);
  return { kind: "mate", value, mate_given: value === 0 && mover === "white" };
}

export function scoreText(score: Score | null | undefined, decimals: 1 | 2 = 2) {
  if (!score) return "—";
  const sign = scoreSide(score) === "black" ? "−" : "+";
  const pawns = decimals === 1
    ? Math.round(Math.abs(score.value) / 10) / 10
    : Math.abs(score.value) / 100;
  if (score.kind === "mate") return `${sign}M${Math.abs(score.value)}`;
  // A score that rounds to nothing favours neither side: 0.0, never −0.0 or +0.0.
  return `${pawns === 0 ? "" : sign}${pawns.toFixed(decimals)}`;
}

/** The review's descriptive advantage bands in centipawns, for either side: the
 * balanced band and the advantage threshold of review intelligence
 * (backend review_intelligence/event_facts.py `advantage`), and the "clearly
 * winning" threshold of Insights (backend game_insights.py `DECISIVE_CP`). */
export const EVALUATION_BANDS = { balanced: 100, advantage: 200, winning: 300 } as const;

/** A plain verdict for a White-perspective score: equal within the balanced
 * band, then slightly better, better and winning. */
export function scoreSummary(score: Score | null | undefined) {
  const side = scoreSide(score);
  if (!score || side === "unknown") return "Not analyzed";
  if (side === "equal") return "Equal";
  const player = side === "white" ? "White" : "Black";
  if (score.kind === "mate")
    return score.value === 0
      ? `${player} checkmates`
      : `${player} mates in ${Math.abs(score.value)}`;
  const size = Math.abs(score.value);
  if (size <= EVALUATION_BANDS.balanced) return "Equal";
  if (size < EVALUATION_BANDS.advantage) return `${player} is slightly better`;
  if (size < EVALUATION_BANDS.winning) return `${player} is better`;
  return `${player} is winning`;
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
