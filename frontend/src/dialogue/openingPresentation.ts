import type {Frame, Game, Position, Report} from "../gameReview/types";
import {stableKey} from "./model";

/** Recognition and its reviewed sequence only; never an assessment of move quality. */
export type BookPresentation = {
  kind: "entry" | "follow";
  variant: number;
  catalogueVersion: string;
  scope: "mainline" | "variation";
  /** Null means that the earlier mainline could not be verified. */
  runStartPly: number | null;
  runOrdinal: number | null;
};

type BookContext = {
  game: Game;
  report?: Report | null;
  frame?: Position | null;
  ply: number;
  variation?: boolean;
};

const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const moveUci = (value: unknown): value is string => typeof value === "string" && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(value);
const opposite = (side: "white" | "black") => side === "white" ? "black" : "white";

function currentReport(report: Report | null | undefined, frame: Position, ply: number,
  variation: boolean): report is Report {
  return !!report && nonempty(frame.fen) && ["white", "black"].includes(frame.turn)
    && nonempty(frame.san) && frame.san === report.actual.san && moveUci(report.actual.uci)
    && report.board_cues?.fen === frame.fen && !!report.intelligence
    && nonempty(report.intelligence.input_digest)
    && (report.intelligence.ply === ply || variation && report.intelligence.ply === null);
}

function mainlineFrame(frame: Frame | undefined, previous: Frame | undefined, report: Report,
  ply: number): frame is Frame {
  return !!frame && !!previous && nonempty(previous.fen) && currentReport(report, frame, ply, false)
    && frame.uci === report.actual.uci && frame.actor === opposite(frame.turn)
    && previous.turn === frame.actor;
}

/** A stable semantic slot shared by written dialogue and every recorded voice. */
export function bookRecordingId(presentation: BookPresentation): string {
  return `book-opening-${presentation.kind}-${presentation.variant}`;
}

export function deriveBookPresentation({game, report, frame, ply, variation = false}: BookContext): BookPresentation | null {
  // A branch's ply is its recorded-game root, including zero at Start.
  if (!frame || !Number.isInteger(ply) || ply < (variation ? 0 : 1) || !nonempty(game.id)
    || !currentReport(report, frame, ply, variation) || report.label !== "Book"
    || !report.opening || !nonempty(report.opening.version)) return null;
  const catalogueVersion = report.opening.version;
  const scope = variation ? "variation" : "mainline";
  const make = (runStartPly: number | null, runOrdinal: number | null): BookPresentation => {
    // Names, scores, search generations, visits and loading progress are not prose seeds.
    const seed = Number.parseInt(stableKey([game.id, catalogueVersion,
      runStartPly ?? ["recognized-position", frame.fen, report.actual.uci]]), 16);
    const kind = runOrdinal !== null && runOrdinal > 1 ? "follow" : "entry";
    const variant = kind === "follow" ? ((runOrdinal! - 2 + seed % 8) % 8) + 1 : (seed % 3) + 1;
    return {kind, variant, catalogueVersion, scope, runStartPly, runOrdinal};
  };
  if (variation) return make(null, null);

  const selected = game.frames[ply];
  if (!selected || selected.fen !== frame.fen || selected.turn !== frame.turn
    || selected.san !== frame.san || selected.uci !== report.actual.uci) return null;
  const context = game.context;
  if (!context || !nonempty(context.input_digest) || context.total_plies < ply) return make(null, null);

  let runStartPly: number | null = null, runOrdinal = 0;
  // Validate from the start, even after a known non-book move. A missing earlier
  // report cannot silently become a remembered run after a later polling update.
  for (let index = 1; index <= ply; index++) {
    const saved = game.frames[index], savedReport = saved?.report;
    if (!savedReport || !mainlineFrame(saved, game.frames[index - 1], savedReport, index)
      || context.missing_plies.includes(index)) return make(null, null);
    const nodes = context.nodes.filter(node => node.ply === index);
    if (nodes.length !== 1 || nodes[0].actor !== saved.actor
      || nodes[0].input_digest !== savedReport.intelligence!.input_digest) return make(null, null);
    if (index === ply && savedReport.intelligence!.input_digest !== report.intelligence!.input_digest)
      return make(null, null);
    if (savedReport.opening) {
      if (savedReport.label !== "Book" || savedReport.opening.version !== catalogueVersion) return make(null, null);
      if (runOrdinal === 0) runStartPly = index;
      runOrdinal++;
    } else {
      if (savedReport.label === "Book") return make(null, null);
      runStartPly = null;
      runOrdinal = 0;
    }
  }
  return runOrdinal > 0 ? make(runStartPly, runOrdinal) : make(null, null);
}
