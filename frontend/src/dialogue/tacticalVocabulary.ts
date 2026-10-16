/** The one vocabulary of tactical motifs (game-review skill IDs) and explanation
 * mechanisms. Dialogue words, recorded meanings and piece subjects derive from it. */

type MotifEntry = {
  /** Spoken name when the skill ID's words would mislead. */
  words?: string;
  /** Scoped tactical wording's name for the motif. */
  scopedName?: string;
  /** Game-review tactic recordings: `tactic-<motif>-<role>`. */
  recorded?: true;
  /** A cause recording, `cause-<motif>`, for the move that created the chance. */
  cause?: true;
  /** Explanation cue recordings: `explanation-cue-<motif>`. */
  cue?: true;
  /** Which witness role names the tactic's piece (pieceVariants.ts). */
  subject?: string;
};

export const tacticalMotifs: Readonly<Record<string, MotifEntry>> = {
  fork: { recorded: true, cue: true, subject: "fork" },
  pin: { recorded: true, cue: true, subject: "pin" },
  skewer: { recorded: true, cue: true, subject: "skewer" },
  removing_defender: {
    recorded: true,
    cue: true,
    subject: "defender",
    scopedName: "removal of a defender",
  },
  back_rank: { recorded: true, cue: true, subject: "back_rank", scopedName: "back-rank mate" },
  promotion_awareness: { recorded: true, cue: true, scopedName: "promotion" },
  discovered_attack: { recorded: true, cue: true, subject: "discovered_attack" },
  double_attack: { recorded: true, cue: true },
  deflection: { recorded: true, cue: true, subject: "defender" },
  hanging_piece: { cue: true, subject: "capture", scopedName: "loose piece" },
  missed_tactical_capture: {
    words: "undefended capture",
    cue: true,
    subject: "capture",
    scopedName: "capture of a loose piece",
  },
  trapped_piece: { scopedName: "trapped piece" },
  abandoned_defender: { cause: true, cue: true, subject: "own_target" },
  opponent_threat_recognition: { cause: true, subject: "own_target" },
  avoiding_bad_trades: { cause: true, cue: true, subject: "moved" },
};

type MechanismEntry = {
  /** An existing recording that already says this finding. */
  alias?: string;
  /** Its own recording: `explanation-finding-<mechanism>`. */
  recorded?: true;
  /** Which finding role names the piece (pieceVariants.ts). */
  subject?: string;
};

export const findingMechanisms: Readonly<Record<string, MechanismEntry>> = {
  fork_recognized: { alias: "tactic-fork-played", subject: "fork" },
  fork_collected: { recorded: true, subject: "fork" },
  pin_prevents_capture: { recorded: true, subject: "pinned" },
  pin_restricts_escape: { recorded: true, subject: "pinned" },
  pin_defenders_no_recapture: { recorded: true },
  pin_collected: { recorded: true, subject: "pin_target" },
  skewer_collected: { recorded: true, subject: "skewer" },
  king_skewer_collected: { recorded: true, subject: "capture" },
  defender_captured: { alias: "tactic-removing-defender-played", subject: "defender" },
  sole_defender_captured: { recorded: true, subject: "defender" },
  deflection: { alias: "tactic-deflection-played", subject: "defender" },
  deflection_collected: { recorded: true, subject: "capture" },
  discovered_capture: { recorded: true, subject: "slider" },
  discovered_check: { recorded: true, subject: "slider" },
  double_check: { recorded: true, subject: "double_check" },
  double_attack_collected: { recorded: true, subject: "second" },
  // A "promotion" finding is the promoting move itself, which the game bank's
  // promotion clips describe as a pawn still on its way, so it has no recording.
  promotion_material_retained: { recorded: true },
  undefended_capture: { alias: "tactic-undefended-capture-played", subject: "capture" },
  undefended_capture_gain: { recorded: true, subject: "capture" },
  back_rank_mate: { alias: "tactic-back-rank-played", subject: "back_rank" },
  abandoned_defender: { alias: "cause-abandoned-defender", subject: "own_target" },
  unfavorable_exchange: { alias: "cause-avoiding-bad-trades", subject: "moved" },
  // Every coach's take says what the backend detects: the opponent's last move
  // freed the attacking piece from a relative pin, and the shown line captures
  // the target that stayed (owner decision, Oct 15).
  relative_pin_released: { recorded: true, subject: "relative_pin" },
};

/** A skill ID or fact value as words ("removing defender"). */
export const words = (value: unknown) =>
  typeof value === "string" ? (tacticalMotifs[value]?.words ?? value.replaceAll("_", " ")) : "";

const keysWhere = <T>(table: Readonly<Record<string, T>>, test: (entry: T) => boolean) =>
  new Set(Object.keys(table).filter(key => test(table[key])));
const projection = <T>(
  table: Readonly<Record<string, T>>,
  value: (entry: T) => string | undefined,
) =>
  Object.fromEntries(
    Object.entries(table).flatMap(([key, entry]) => {
      const projected = value(entry);
      return projected === undefined ? [] : [[key, projected]];
    }),
  ) as Record<string, string>;

export const recordedTacticMotifs: ReadonlySet<string> = keysWhere(
  tacticalMotifs,
  entry => !!entry.recorded,
);
export const causeMotifs: ReadonlySet<string> = keysWhere(tacticalMotifs, entry => !!entry.cause);
export const cueMotifs: ReadonlySet<string> = keysWhere(tacticalMotifs, entry => !!entry.cue);
export const tacticSubjects: Readonly<Record<string, string>> = projection(
  tacticalMotifs,
  entry => entry.subject,
);
/** Keyed by the motif's words, as claim slots carry it. */
export const scopedMotifNames: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(tacticalMotifs).flatMap(([key, entry]) =>
    entry.scopedName ? [[words(key), entry.scopedName]] : [],
  ),
);

export const findingAliases: Readonly<Record<string, string | undefined>> = projection(
  findingMechanisms,
  entry => entry.alias,
);
export const recordedFindingMechanisms: ReadonlySet<string> = keysWhere(
  findingMechanisms,
  entry => !!entry.recorded,
);
export const findingSubjects: Readonly<Record<string, string>> = projection(
  findingMechanisms,
  entry => entry.subject,
);
