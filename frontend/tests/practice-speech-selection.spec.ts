import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { ColdPosition, ExplanationFrame, Feedback, MoveExplanation, PatternFinding, Schema } from "../src/api";
import { explanationCueRecording, explanationFindingRecording, explanationFrameRecording, explanationNoteRecording,
  explanationSummaryRecording, openingRecallRecording, practiceRecording, puzzleRecording } from "../src/audio/speech/practiceSelection";

const inventory = JSON.parse(readFileSync(new URL("../src/audio/speech/bank/manifest.json", import.meta.url), "utf8")) as {recordings: {id: string}[]};
const bank = new Set(inventory.recordings.map(recording => recording.id));
const frame = (overrides: Partial<ExplanationFrame> = {}): ExplanationFrame => ({
  fen: "saved-frame", uci: "e2e4", san: "e4", annotation: "Saved move.", highlights: [], material_change: 0,
  capture: null, gives_check: false, facts_version: 1, promotion: null, castling: false, checkmate: false,
  escaped_check: false, ...overrides,
});
const position: ColdPosition = {exercise_id: "exercise", session_id: "session", failed: false, fen: "cold",
  last_attempt_id: null, legal_moves: [], orientation: "white", practice_only: false, previous_reviews: 0, review_reason: "new"};
const feedback = (overrides: Partial<Feedback> = {}): Feedback => ({completed: true, grade: "accepted", attempt_id: "attempt", ...overrides});
const explanation = (overrides: Partial<MoveExplanation> = {}): MoveExplanation => ({
  version: "1", attempt_id: "attempt", authority: "stockfish", accepted: true, move_uci: "e2e4", move_san: "e4",
  summary: "Saved summary.", notes: [], frames: [frame({uci: null}), frame()], orientation: "white", analysis_id: "analysis", ...overrides,
});
const finding = (overrides: Partial<PatternFinding> = {}): PatternFinding => ({
  actor: "white", analysis_id: "analysis", direction: "missed_opportunity", explanation: "Saved witness.",
  frame_ply: 1, moves: ["e2e4"], plies: [1], rule_id: "verified", skill_id: "fork", squares: ["e4"],
  verification: "verified_line", cue: "Saved cue.", mechanism: "fork_collected", cue_key: "fork", ...overrides,
});

test("all twenty recorded frame combinations use explicit replay facts and retain combined meaning", () => {
  const selected = [explanationFrameRecording(frame({uci: null}), 0)];
  for (const capture of [null, "pawn"]) for (const promotion of [null, "queen"]) {
    for (const ending of ["ordinary", "check", "mate", "escape"] as const) {
      const id = explanationFrameRecording(frame({capture, promotion, gives_check: ending === "check" || ending === "mate",
        checkmate: ending === "mate", escaped_check: ending === "escape"}), 1);
      const expected = !capture && !promotion && ending === "mate" ? "mate-finished"
        : `explanation-frame-${capture ? "capture" : "quiet"}-${promotion ? "promotion" : "move"}-${ending}`;
      expect(id).toBe(expected);
      selected.push(id);
    }
  }
  for (const ending of ["ordinary", "check", "mate"] as const) {
    selected.push(explanationFrameRecording(frame({castling: true, gives_check: ending !== "ordinary", checkmate: ending === "mate"}), 1));
  }
  expect(selected).toHaveLength(20);
  for (const id of selected) expect(bank.has(id!)).toBe(true);
  expect(explanationFrameRecording(frame({facts_version: null, san: "Qxh8#", annotation: "Checkmate!"}), 1)).toBeNull();
  expect(explanationFrameRecording(frame({castling: true, capture: "pawn"}), 1)).toBeNull();
  expect(explanationFrameRecording(frame({uci: null}), 1)).toBeNull();
});

test("cold practice cannot borrow future frames or reveal an answer", () => {
  expect(practiceRecording({position, feedback: null, frame: frame({checkmate: true})})).toBe("srs-cold");
  expect(practiceRecording({position: {...position, failed: true}, feedback: null})).toBe("srs-retry");
  expect(practiceRecording({position, feedback: feedback(), error: true})).toBe("srs-practice-error");
});

test("practice summaries follow producer identity, never matching legacy or arbitrary English", () => {
  expect(practiceRecording({position, feedback: feedback({explanation_summary: "A forced mate.", explanation_summary_kind: "mate_for_mover"})})).toBe("srs-summary-mate-for-mover");
  expect(practiceRecording({position, feedback: feedback({explanation_summary: "A forced mate."})})).toBeNull();
  expect(practiceRecording({position, feedback: feedback({message: "Good move."})})).toBeNull();
  expect(practiceRecording({position, feedback: feedback({message: "Good move.", message_kind: "good_move"})})).toBe("srs-fallback-good");
  expect(practiceRecording({position, feedback: feedback({message: "Good move.", message_kind: "good_move", grade: "revealed"})})).toBeNull();
  expect(practiceRecording({position, feedback: feedback({explanation_summary: "Legacy authored teaching", message: "Good move.", message_kind: "good_move"})})).toBeNull();
  expect(practiceRecording({position, feedback: feedback({completed: false}), frame: frame({capture: "rook", gives_check: true})})).toBe("explanation-frame-capture-move-check");
  expect(practiceRecording({position, feedback: feedback({completed: false})})).toBe("srs-retry");
  expect(practiceRecording({position, feedback: feedback()})).toBe("srs-fallback-study");
});

test("explanation summaries preserve authority and exact summary frame", () => {
  for (const kind of ["mate_for_mover", "mate_against_mover", "material_gain", "material_loss", "engine_accepted", "engine_rejected"] as const)
    expect(bank.has(explanationSummaryRecording(explanation({summary_kind: kind}))!)).toBe(true);
  expect(explanationSummaryRecording(explanation({summary_kind: "curated_accepted"}))).toBeNull();
  expect(explanationSummaryRecording(explanation({authority: "curated", summary_kind: "curated_accepted"}))).toBe("srs-summary-curated-accepted");
  expect(explanationSummaryRecording(explanation({summary_kind: "frame", summary_frame_index: 1,
    frames: [frame({uci: null}), frame({promotion: "queen", checkmate: true})]}))).toBe("explanation-frame-quiet-promotion-mate");
  expect(explanationSummaryRecording(explanation({summary_kind: "frame", summary_frame_index: 20}))).toBeNull();
});

test("selected finding and cue require the same analysis, witness moves and displayed frame", () => {
  const item = finding();
  const data = explanation({findings: [item]});
  expect(explanationFindingRecording(data, item, 1)).toBe("explanation-finding-fork-collected");
  expect(explanationCueRecording(data, item, 1)).toBe("explanation-cue-fork");
  expect(explanationFindingRecording(data, item, 0)).toBeNull();
  expect(explanationFindingRecording({...data, analysis_id: "different"}, item, 1)).toBeNull();
  expect(explanationFindingRecording({...data, frames: [frame({uci: null}), frame({uci: "d2d4"})]}, item, 1)).toBeNull();
  expect(explanationFindingRecording(data, {...item}, 1)).toBeNull();
  for (const patch of [{mechanism: null}, {mechanism: "previous_threat"}, {mechanism: "relative_pin_released"}] as const) {
    const legacy = finding(patch);
    expect(explanationFindingRecording(explanation({findings: [legacy]}), legacy, 1)).toBeNull();
  }
  const legacy = finding({cue_key: null});
  expect(explanationCueRecording(explanation({findings: [legacy]}), legacy, 1)).toBeNull();
});

test("every supported finding mechanism maps to its full recorded meaning, including game-bank aliases", () => {
  const mechanisms: NonNullable<PatternFinding["mechanism"]>[] = ["fork_recognized", "fork_collected", "pin_prevents_capture", "pin_restricts_escape",
    "pin_defenders_no_recapture", "pin_collected", "skewer_collected", "king_skewer_collected", "defender_captured", "sole_defender_captured",
    "deflection", "deflection_collected", "discovered_capture", "discovered_check", "double_check", "double_attack_collected", "promotion",
    "promotion_material_retained", "undefended_capture", "undefended_capture_gain", "back_rank_mate", "abandoned_defender", "unfavorable_exchange"];
  for (const mechanism of mechanisms) {
    const item = finding({mechanism});
    const id = explanationFindingRecording(explanation({findings: [item]}), item, 1);
    expect(bank.has(id!), mechanism).toBe(true);
  }
});

test("notes need producer note identities; unstructured notes remain silent", () => {
  const notes = ["curated_authority", "strong_replies", "material_scope", "no_simple_reason", "saved_policy"] as const;
  const data = explanation({notes: notes.map(() => "Visible note"), note_kinds: [...notes]});
  notes.forEach((_, i) => expect(bank.has(explanationNoteRecording(data, i)!)).toBe(true));
  expect(explanationNoteRecording({...data, note_kinds: []}, 0)).toBeNull();
  expect(explanationNoteRecording(data, 6)).toBeNull();
});

test("all supported teaching cues retain their selected finding's explicit cue identity", () => {
  for (const skill_id of ["hanging_piece", "missed_tactical_capture", "fork", "pin", "skewer", "removing_defender",
    "discovered_attack", "double_attack", "back_rank", "promotion_awareness", "abandoned_defender", "avoiding_bad_trades", "deflection"]) {
    const item = finding({skill_id, cue_key: skill_id});
    expect(bank.has(explanationCueRecording(explanation({findings: [item]}), item, 1)!)).toBe(true);
  }
  const mismatched = finding({skill_id: "pin", cue_key: "fork"});
  expect(explanationCueRecording(explanation({findings: [mismatched]}), mismatched, 1)).toBeNull();
});

test("opening recall keeps repertoire authority, changed-study rejection and reveal distinct", () => {
  const opening = {...position, opening: {color: "white" as const, names: ["Line"], prompt: "Recall", revision: 1}};
  const select = (result: Feedback | null, failed = false, error = false) => openingRecallRecording({position: opening, feedback: result, failed, error});
  expect(select(null)).toBe("opening-recall-cold-single");
  expect(openingRecallRecording({position: {...opening, opening: {...opening.opening, names: ["First", "Second"]}}, feedback: null, failed: false, error: false})).toBe("opening-recall-cold-multiple");
  expect(select(null, true)).toBe("opening-recall-retry-fallback");
  expect(select(feedback())).toBe("opening-recall-accepted");
  expect(select(feedback({grade: "revealed"}))).toBe("opening-recall-revealed");
  for (const suffix of ["", "_changed", "_retired"] as const) {
    expect(select(feedback({completed: false, message: "Written feedback", message_kind: `opening_rejected${suffix}`})))
      .toBe(`opening-recall-rejected${suffix.replaceAll("_", "-")}`);
  }
  expect(select(feedback({completed: false, message: "This move is outside the opening moves you selected to study. Try again."}))).toBeNull();
  expect(select(feedback(), false, true)).toBe("srs-practice-error");
});

test("puzzle guidance distinguishes all eight fixed states without inferring objective chess quality", () => {
  const session: Schema["PuzzleSessionView"] = {id: "puzzle", revision: 1, source: "generic", status: "active", current_step: 0,
    failed: false, feedback: null, fen: "cold", history: [], legal_moves: [], orientation: "white", playback: [], completion: null};
  const select = (value = session, flags = {}) => puzzleRecording({session: value, error: false, playing: false, retrying: false, ...flags});
  expect(select()).toBe("puzzle-cold");
  expect(select(session, {error: true})).toBe("puzzle-error");
  expect(select(session, {playing: true})).toBe("puzzle-playback");
  expect(select(session, {retrying: true})).toBe("puzzle-rejected");
  expect(select({...session, feedback: {grade: "correct", submitted_san: "e4"}})).toBe("puzzle-next-move");
  expect(select({...session, status: "solved"})).toBe("puzzle-solved-clean");
  expect(select({...session, status: "solved", failed: true})).toBe("puzzle-solved-after-retry");
  expect(select({...session, status: "revealed"})).toBe("puzzle-revealed");
});
