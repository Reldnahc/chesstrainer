// Complete, contract-valid review events and game relationships for tests. Each kind's
// facts are typed by the API, so a test names only the facts it is about and the rest
// take neutral defaults here; a fact the backend renames fails these types too.
import type { ReviewEvent, ReviewEventOf, Schema } from "../../src/api";

type Kind = ReviewEvent["kind"];
export type FactsOf<K extends Kind> = ReviewEventOf<K>["facts"];
type Positional = FactsOf<"positional">;
type Feature = Positional["feature"];
// The passed- and isolated-pawn facts share one shape, whose feature is either name.
export type PositionalOf<F extends Feature> = Positional extends infer P
  ? P extends { feature: infer G }
    ? F extends G
      ? P
      : never
    : never
  : never;

export type GameRelationship = Schema["GameContext"]["relationships"][number];
type RelationKind = GameRelationship["kind"];
export type RelationOf<K extends RelationKind> = Extract<GameRelationship, { kind: K }>;

const score = { kind: "cp" as const, value: 0, mate_given: false };

const positionalBase = {
  side: "white" as const,
  squares: [],
  line: "actual" as const,
  uci: "e2e4",
  value_judgment: "not_inferred" as const,
};

const positionalDefaults: { [F in Feature]: PositionalOf<F> } = {
  first_development: {
    ...positionalBase,
    feature: "first_development",
    before: "g1",
    after: "f3",
    piece: "knight",
  },
  castling: {
    ...positionalBase,
    feature: "castling",
    before: "e1",
    after: "g1",
    adjacent_pawns: [],
  },
  king_flights: {
    ...positionalBase,
    feature: "king_flights",
    before: [],
    after: [],
    opened: [],
    king: "g1",
  },
  passed_pawns: {
    ...positionalBase,
    feature: "passed_pawns",
    before: [],
    after: [],
    added: [],
    removed: [],
  },
  isolated_pawns: {
    ...positionalBase,
    feature: "isolated_pawns",
    before: [],
    after: [],
    added: [],
    removed: [],
  },
  doubled_files: {
    ...positionalBase,
    feature: "doubled_files",
    before: [],
    after: [],
    added: [],
    removed: [],
  },
  passed_pawn_advance: {
    ...positionalBase,
    feature: "passed_pawn_advance",
    before: "d5",
    after: "d6",
  },
  rook_file: {
    ...positionalBase,
    feature: "rook_file",
    before: "closed",
    after: "open",
    file: "d",
  },
  piece_support: {
    ...positionalBase,
    feature: "piece_support",
    before: [],
    after: [],
    piece: "knight",
    target: "f3",
    attacked: false,
  },
  bishop_pair: { ...positionalBase, feature: "bishop_pair", before: 2, after: 1 },
};

const defaults: { [K in Exclude<Kind, "positional">]: FactsOf<K> } = {
  mate: { transition: "allowed", best: score, actual: score, mate_in: null },
  forced_mate: { stage: "started", winner: "mover", mate_in: 3, best: score, actual: score },
  evaluation_change: {
    from_band: "balanced",
    to_band: "disadvantage",
    loss_cp: 0,
    lost_advantage: false,
    decisive: false,
  },
  critical_resource: { only_good_at_depth: 16, difficult: false, purpose: "defense" },
  sacrifice: { acceptance_move: "e4f5", acceptance_score: score, sound_at_depth: 16 },
  tactic: {
    motif: "fork",
    role: "played",
    opportunity_actor: null,
    rule_id: "fixture",
    frame_ply: 0,
    plies: [1],
    moves: [],
    squares: [],
    roles: {},
    pinned_before: null,
    verification: "verified_line",
    context_fen: null,
    context_move: null,
    witness: [],
    pieces: {},
    settled_material_delta: null,
  },
  human_contrast: {
    observations: ["natural_error"],
    played_naturalness: "preferred",
    best_naturalness: "plausible",
    confidence: "heuristic",
    domain: null,
    conditioning: null,
  },
  clock_observation: {
    before_band: "low",
    tempo: "ordinary",
    before_seconds: null,
    elapsed_seconds: null,
    accompanied_error: null,
    causation: "not_inferred",
  },
  opening_departure: { catalogue: "fixture", previous_book_ply: 0, previous_name: null },
  check: { gives_check: true, escapes_check: false },
  finish: { termination: "checkmate", result: "1-0" },
};

/** One witnessed ply of a tactic line, with neutral capture and check facts. */
export const witness = (
  ply: number,
  san: string,
  extra: Partial<FactsOf<"tactic">["witness"][number]> = {},
) => ({
  ply,
  san,
  capture: null,
  gives_check: false,
  ...extra,
});

/** Positional facts for one feature, with the given facts over neutral defaults. */
export function positionalFacts<F extends Feature>(
  feature: F,
  facts: Partial<PositionalOf<F>> = {},
): PositionalOf<F> {
  return { ...positionalDefaults[feature], ...facts };
}

/** A review event of ``kind`` whose facts are ``facts`` over the kind's defaults. */
export function reviewEvent<K extends Exclude<Kind, "positional">>(
  kind: K,
  facts: Partial<FactsOf<K>> = {},
  extra: Partial<Omit<ReviewEventOf<K>, "kind" | "facts">> = {},
): ReviewEventOf<K> {
  return {
    id: `event-${kind}`,
    actor: "white",
    confidence: "searched",
    importance: 75,
    evidence: [{ source: "stockfish", id: "search", field: "root" }],
    ...extra,
    kind,
    facts: { ...defaults[kind], ...facts },
  } as unknown as ReviewEventOf<K>;
}

/** A positional review event for one feature. */
export function positionalEvent<F extends Feature>(
  feature: F,
  facts: Partial<PositionalOf<F>> = {},
  extra: Partial<Omit<ReviewEventOf<"positional">, "kind" | "facts">> = {},
): ReviewEventOf<"positional"> {
  return {
    id: `position-${feature}`,
    actor: "white",
    confidence: "board_fact",
    importance: 30,
    evidence: [{ source: "position", id: "fixture", field: "immediate_transition" }],
    ...extra,
    kind: "positional",
    facts: positionalFacts(feature, facts),
  };
}

const relationDefaults: { [K in RelationKind]: RelationOf<K>["facts"] } = {
  repeated_motif: {
    motif: "fork",
    role: "missed",
    occurrence: 2,
    first_ply: 1,
    scope: "observed_reviewed_plies",
  },
  punishment: { outcome: "capitalized", opportunity: "advantage" },
  recovery: { outcome: "playable_position", opponent_errors: [] },
  advantage_run: {
    outcome: "maintained",
    result_source: null,
    threshold: "200cp_or_searched_mate",
    reviewed_plies: 2,
    own_error_plies: [],
  },
  erosion: { total_conceded_cp: 0, net_deterioration_cp: 0, own_mistake_plies: [] },
  support_restored: { piece: "knight", target: "f3", causation: "support_change_only" },
};

/** A game relationship of ``kind`` whose facts are ``facts`` over the kind's defaults. */
export function gameRelationship<K extends RelationKind>(
  kind: K,
  facts: Partial<RelationOf<K>["facts"]> = {},
  extra: Partial<Omit<RelationOf<K>, "kind" | "facts">> = {},
): RelationOf<K> {
  return {
    id: kind,
    actor: "white",
    plies: [0, 1],
    event_ids: [],
    evidence: [{ source: "stockfish", id: "search", field: "root" }],
    ...extra,
    kind,
    facts: { ...relationDefaults[kind], ...facts },
  } as unknown as RelationOf<K>;
}
