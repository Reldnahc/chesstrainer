import {test, expect} from "@playwright/test";
import {gameIntent} from "../src/dialogue/gameIntent";
import {practiceIntent, explanationIntent} from "../src/dialogue/practiceIntent";
import {renderNeutral} from "../src/dialogue/neutral";
import {claim, makeIntent, stableKey} from "../src/dialogue/model";
import {positionalClaim} from "../src/dialogue/eventClaims";
import type {Game, Position, Report} from "../src/gameReview/types";
import type {ColdPosition, ExplanationFrame, Schema} from "../src/api";

const ref = {source: "stockfish" as const, id: "search", field: "root"};
const event = (kind: Schema["ReviewEvent"]["kind"], facts: Schema["ReviewEvent"]["facts"]): Schema["ReviewEvent"] =>
  ({id: `event-${kind}`, actor: "white", confidence: "searched", importance: 75, kind, facts, evidence: [ref]});
const report = (events: Schema["ReviewEvent"][] = []): Report => ({label: "Blunder", engine_label: "Blunder",
  actual: {uci: "e2e4", san: "e4", score: {kind: "cp", value: -250}},
  best: {uci: "d2d4", san: "d4", score: {kind: "cp", value: 50}},
  intelligence: {version: "move-events-4", input_digest: "facts", ply: 1, events, clock: null, limitations: []},
} as Report);
const game = {frames: [{}, {number: 1, san: "e4", actor: "white"}], orientation: "white"} as Game;
const frame = {turn: "black", fen: "position"} as Position;
const args = {game, frame, key: "game:1:", ply: 1, expression: "blunder" as const};

test("semantic dialogue names supported tactics, replies and exact severity without inventing causes", () => {
  const tactic = event("tactic", {role: "allowed", motif: "fork", roles: {targets: ["e4", "h7"]},
    pieces: {e4: {piece: "queen", color: "white"}, h7: {piece: "king", color: "white"}}});
  tactic.actor = "black";
  const intent = gameIntent({...args, report: report([tactic])});
  expect(renderNeutral(intent).text).toMatch(/queen on e4 and king on h7/);
  expect(intent.claims[0].sourceIds).toEqual([tactic.id]);
  const plain = renderNeutral(gameIntent({...args, report: report()})).text;
  expect(plain).toContain("3.00 pawns");
  expect(plain).not.toMatch(/weak square|bad bishop|king safety|fork/);
  const withReply = report();
  withReply.immediate_reply = {san: "Nxe4", capture: "pawn", gives_check: false} as ExplanationFrame;
  expect(renderNeutral(gameIntent({...args, report: withReply})).text).toContain("White's pawn");
});

test("human naturalness does not become a population claim or override the grade", () => {
  const value = report();
  value.practical = {interpretations: ["natural_error"], limitations: ["source_domain_shift"], stockfish_analysis_ids: ["search"]} as Report["practical"];
  value.human = {evidence_id: "model"} as Report["human"];
  const intent = gameIntent({...args, report: value});
  expect(intent.purpose).toBe("blunder");
  expect(intent.decisions).toContain("source_domain_shift");
  const text = renderNeutral(intent).text;
  expect(text).toContain("human model");
  expect(text).not.toMatch(/%|players at your|you thought/);
});

test("recorded relationships need the matching node and never follow a variation", () => {
  const value = report();
  const context = {nodes: [{ply: 1, input_digest: "facts", evidence: [ref]}], turning_points: [],
    relationships: [{id: "recovery", kind: "recovery", actor: "white", plies: [0, 1], facts: {opponent_errors: [0]}, evidence: [ref]}]} as Game["context"];
  const full = {...args, game: {...game, context}, report: value};
  expect(renderNeutral(gameIntent(full)).text).toMatch(/playable.*opponent's errors/i);
  expect(gameIntent(full).expression).toBe("recovered");
  expect(renderNeutral(gameIntent({...full, variation: true})).text).not.toMatch(/playable|recovered|opponent's errors/);
  const stale = {...context!, nodes: []};
  expect(gameIntent({...full, game: {...game, context: stale}}).claims.some(c => c.code === "recovery")).toBe(false);
});

test("book is recognition, positive findings teach and arbitrary structure is not a cause", () => {
  const value = report();
  value.opening = {name: "Bongcloud", version: "openings"} as Report["opening"];
  value.label = "Book";
  expect(renderNeutral(gameIntent({...args, report: value})).text).toContain("does not mean the move is sound");
  const fact = event("positional", {feature: "rook_file", line: "actual", side: "black", after: "open", file: "d"});
  expect(renderNeutral(makeIntent("key", "best", "game", "best", [positionalClaim(fact, "exd5", "Nf3")!])).text).toContain("black's rook");
  expect(positionalClaim(event("positional", {feature: "bad_bishop"}), "e4", "d4")).toBeNull();
  const best = {...report([event("critical_resource", {purpose: "defense", difficult: true})]), label: "Great", engine_label: "Great"} as Report;
  expect(renderNeutral(gameIntent({...args, report: best})).text).toMatch(/only searched move|searched alternatives/);
});

test("deterministic variants survive reordering and leave evidence untouched", () => {
  const input = {...args, report: report()};
  const saved = JSON.stringify(input);
  const first = renderNeutral(gameIntent(input));
  expect(renderNeutral(gameIntent(JSON.parse(saved)))).toEqual(first);
  expect(JSON.stringify(input)).toBe(saved);
  expect(stableKey({a: 1, b: 2})).toBe(stableKey({b: 2, a: 1}));
  expect(first.text.length).toBeLessThanOrEqual(290);
  const broken = renderNeutral(makeIntent("bad", "uncertain", "game", "uncertain", [claim("missing"), claim("reply_capture")]));
  expect(broken.text).not.toContain("{");
  expect(broken.text).toContain("does not support");
});

test("cold SRS ignores poisoned future feedback and exposes no tactical or historical hints", () => {
  const position = {session_id: "cold", failed: false, motif: "fork", best: "Nf3", explanation_summary: "win a queen"} as unknown as ColdPosition;
  const preview = {fen: "fen", annotation: "Fork the queen with Nf3"} as ExplanationFrame;
  const cold = {position, feedback: null, frame: preview, hadFailure: false, expression: "neutral" as const};
  expect(renderNeutral(practiceIntent(cold)).text).toBe("Tap a piece, then its destination.");
  const result = practiceIntent({...cold, feedback: {completed: true, grade: "good", attempt_id: "attempt", explanation_summary: "The knight forks king and queen."}, frame: null, hadFailure: true, expression: "recovered"});
  expect(renderNeutral(result).text).toContain("knight forks");
  expect(result.purpose).toBe("recovery");
  expect(result.autoSpeakSuitable).toBe(false);
  const explanation = explanationIntent("attempt", {analysis_id: "saved-search", authority: "stockfish", summary: "The fork wins material."} as Schema["MoveExplanation"], preview, 1);
  expect(explanation.claims[0].evidence[0].id).toBe("saved-search");
});

test("delivery severity stays independent of bubble claim ordering and uncertain output stays quiet", () => {
  const book = makeIntent("opening", "book", "game", "book", [claim("book_sound", {opening: "Opening"}, 96)]);
  const brilliant = makeIntent("sacrifice", "brilliant", "game", "brilliant", [claim("sacrifice", {}, 90)]);
  const inaccuracy = makeIntent("slip", "inaccuracy", "game", "inaccuracy", [claim("loss", {loss: "0.65"}, 82)]);
  const blunder = makeIntent("error", "blunder", "game", "blunder", [claim("loss", {loss: "4.10"}, 82)]);
  const mate = makeIntent("mate-in-book", "book", "game", "book", [claim("allowed_mate", {opponent: "Black"}, 100)]);
  expect(book.priority).toBeLessThan(brilliant.priority);
  expect(book.intensity).toBeLessThan(inaccuracy.intensity);
  expect(inaccuracy.intensity).toBeLessThan(blunder.intensity);
  expect(blunder.intensity).toBeLessThan(mate.intensity);
  expect(book.interruptible).toBe(true);
  expect(mate.interruptible).toBe(false);
  expect(makeIntent("opening", "book", "game", "book", [claim("book_sound", {opening: "Opening"}, 1)]).intensity).toBe(book.intensity);
  const unavailable = makeIntent("failed", "uncertain", "variation", "uncertain", [claim("unavailable")]);
  expect(unavailable.autoSpeakSuitable).toBe(false);
  expect(renderNeutral(mate).intensity).toBe(mate.intensity);
});
