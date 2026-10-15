import type { Arrow } from "react-chessboard";
import type { Report } from "./gameReview/types";

type Cues = NonNullable<Report["board_cues"]>;

/** Arrow colours with their fade as the alpha (Board draws each arrow opaque,
 * then fades it whole), named for what the arrow means rather than per page. */
export const ARROW_COLOURS = {
  /** Show why: the move being explained. */
  move: "#b8d69be6",
  /** Show why: the reply the move allows or prevents. */
  reply: "#ffb17be6",
  /** Show why: any other line the explanation marks. */
  threat: "#ff7187db",
  /** Game review: the opponent's strongest answer, faded as a suggestion. */
  suggestedReply: "#4f9cff8c",
  /** A pin made by the move just played. */
  pin: "#ff71878c",
  /** Book moves in Play and a lesson's annotated arrows. */
  book: "#f5b56abb",
} as const;

/** The two squares a UCI move highlights: where it started and where it landed. */
export const moveSquares = (uci: string | null | undefined): string[] => (uci ? [uci.slice(0, 2), uci.slice(2, 4)] : []);

/** One arrow along a UCI move. */
export const uciArrow = (uci: string, color: string): Arrow => ({ startSquare: uci.slice(0, 2), endSquare: uci.slice(2, 4), color });

/** A report's board cues, only while the board shows the position they were made for. */
export const cuesFor = (report: Report | null | undefined, frame: { fen: string } | null | undefined): Cues | null =>
  report?.board_cues && report.board_cues.fen === frame?.fen ? report.board_cues : null;

/** Show why's arrows in their named colours. */
export const cueArrows = (cues: Cues): Arrow[] =>
  cues.arrows.map((arrow) => ({
    ...arrow,
    color: arrow.kind === "move" ? ARROW_COLOURS.move : arrow.kind === "reply" ? ARROW_COLOURS.reply : ARROW_COLOURS.threat,
  }));
