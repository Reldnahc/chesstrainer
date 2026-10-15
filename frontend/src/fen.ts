// Reading the fields of a FEN. The backend owns every chess rule; these only
// label positions it already sent. For a UCI move's squares see boardCues.ts.

/** The standard starting position. */
export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** The side to move in a FEN. */
export function sideToMove(fen: string): "white" | "black" {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}

/** "White" or "Black", for "… to move" labels. */
export const sideName = (side: "white" | "black") => (side === "white" ? "White" : "Black");

/** A move number as notation writes it: "12." before White's move, "12…" before Black's. */
export const moveNumber = (number: number | string, mover: "white" | "black") =>
  `${number}${mover === "black" ? "…" : "."}`;

/** A move with its number, from the position before it: "12. Nf3" or "12… Nc6". */
export function numberedSan(beforeFen: string, san: string) {
  return `${moveNumber(beforeFen.split(" ")[5], sideToMove(beforeFen))} ${san}`;
}

/** Whose move a played-back frame is, for a learner playing `learner`. */
export function playbackMover(beforeFen: string, learner: "white" | "black") {
  return sideToMove(beforeFen) === learner ? "Your move" : "Opponent reply";
}
