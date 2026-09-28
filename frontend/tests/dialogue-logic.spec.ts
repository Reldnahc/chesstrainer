import {test, expect} from "@playwright/test";
import {gameIntent} from "../src/dialogue/gameIntent";
import {practiceIntent, explanationIntent} from "../src/dialogue/practiceIntent";
import {renderDialogue, renderNeutral} from "../src/dialogue/neutral";
import {neutralPersonality} from "../src/dialogue/personality";
import {neutralTemplates} from "../src/dialogue/templates";
import {claim, makeIntent, stableKey} from "../src/dialogue/model";
import {positionalClaim} from "../src/dialogue/eventClaims";
import type {Game, Position, Report} from "../src/gameReview/types";
import type {ColdPosition, ExplanationFrame, Schema} from "../src/api";
import {semanticFixtures} from "./semantic-fixtures";
import {positionalClaims} from "./positional-claims";
import {humanGames, humanIntent} from "./human-fixtures";

const ref = {source: "stockfish" as const, id: "search", field: "root"};
const event = (kind: Schema["ReviewEvent"]["kind"], facts: Schema["ReviewEvent"]["facts"]): Schema["ReviewEvent"] =>
  ({id: `event-${kind}`, actor: "white", confidence: "searched", importance: 75, kind, facts, evidence: [ref]});
const report = (events: Schema["ReviewEvent"][] = []): Report => ({label: "Blunder", engine_label: "Blunder",
  actual: {uci: "e2e4", san: "e4", depth: 16, pv: ["e2e4"], score: {kind: "cp", value: -250, mate_given: false}},
  best: {uci: "d2d4", san: "d4", depth: 16, pv: ["d2d4"], score: {kind: "cp", value: 50, mate_given: false}},
  opening: null, board_cues: null, coach: "", reason: "Synthetic evaluation loss", depth: 16, engine_version: "test",
  white_score: {kind: "cp", value: -250, mate_given: false},
  intelligence: {version: "move-events-4", input_digest: "facts", ply: 1, events, clock: null, limitations: []},
});
const game = {frames: [{}, {number: 1, san: "e4", actor: "white"}], orientation: "white"} as Game;
const frame = {turn: "black", fen: "position"} as Position;
const args = {game, frame, key: "game:1:", ply: 1, expression: "blunder" as const};

const positionFixtures = semanticFixtures<{feature: string; code: string; mirrored: boolean; alternative: Schema["GameReviewReport"]; actual: Schema["GameReviewReport"]}[]>("review_position_fixtures.py");
for (const fixture of positionFixtures) test(`${fixture.feature} preserves actual versus unplayed consequences (${fixture.mirrored ? "mirror" : "original"})`, () => {
  for (const kind of ["actual", "alternative"] as const) {
    const value = fixture[kind];
    const turn = value.actual_line!.frames[1].fen.split(" ")[1] === "w" ? "white" : "black";
    const intent = gameIntent({...args, frame: {...frame, turn}, report: value});
    const item = intent.claims.find(c => c.code === fixture.code)!;
    expect(item).toBeTruthy();
    // Isolate one selected claim to prove its language even if a compact bubble
    // omits this lower-priority fact in favor of another supported consequence.
    const text = renderNeutral({...intent, claims: [item]}).text;
    expect(text).toContain(kind === "alternative" ? value.best.san : fixture.feature === "doubled_files" ? "doubled" : "bishops");
    if (kind === "alternative") expect(text).toContain(`${value.best.san} would `);
    else expect(text).not.toMatch(/would|unplayed|instead/);
    expect(text).toContain(fixture.mirrored ? "black" : "white");
  }
});

test("every positional claim carries branch scope that personality wording cannot discard", () => {
  for (const line of ["actual", "best"] as const) for (const item of positionalClaims(line)) {
    expect(item).toBeTruthy();
    expect(item.position).toEqual({line: line === "actual" ? "actual" : "alternative", move: line === "actual" ? "played" : "alternative"});
    const intent = makeIntent("grammar", "mistake", "game", "mistake", [item]);
    const character = {id: "unsafe-override", personality: {...neutralPersonality, version: "branch-safety-test", templates: {[item.code]: ["This already happened on the actual board."]}}};
    const rendered = renderDialogue(intent, character);
    const text = rendered.text;
    if (line === "best") {
      expect(text).toMatch(/^alternative would /);
      expect(text).not.toContain("already happened");
      expect(rendered.trace.variants[0].source).toBe("positional-conditional-1");
    } else {
      // Actual-move customization still has to carry the mandatory facts. An
      // empty assertion is no longer a valid custom form under the slot guard.
      expect(text).toBe(renderNeutral(intent).text);
      expect(rendered.trace.variants[0].source).toBe("neutral-1");
    }
    const valid = {...character, personality: {...character.personality,
      templates: {[item.code]: [`Verified actual consequence: ${neutralTemplates[item.code][0]}`]}}};
    const validOutput = renderDialogue(intent, valid);
    if (line === "best") {
      expect(validOutput.text).toMatch(/^alternative would /);
      expect(validOutput.text).not.toContain("Verified actual consequence");
      expect(validOutput.trace.variants[0].source).toBe("positional-conditional-1");
    } else {
      expect(validOutput.text).toContain("Verified actual consequence: played");
      expect(validOutput.trace.variants[0].source).toBe("branch-safety-test");
    }
  }
  const unsupported = {...positionalClaims("best")[0], code: "future_feature"};
  const fallback = renderNeutral(makeIntent("unknown", "mistake", "game", "mistake", [unsupported]));
  expect(fallback.trace.variants).toEqual([]);
});

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
  const game = humanGames.natural_error, value = game.frames[1].report!;
  const intent = humanIntent(game);
  expect(intent.purpose).toBe("book");
  expect(value.engine_label).toBe("Blunder");
  expect(intent.decisions).toContain("domain_shift");
  const text = renderNeutral(intent).text;
  expect(text).toContain("natural mistake");
  expect(text).toContain("3.40 pawns");
  expect(text).not.toMatch(/%|players at your|you thought/);
});

test("a mate explanation names the immediate check once without suppressing a separate reply", () => {
  const value = report([event("mate", {transition: "allowed"})]);
  value.immediate_reply = {san: "Qh4#", capture: null, gives_check: true} as ExplanationFrame;
  const intent = gameIntent({...args, report: value});
  expect(intent.claims.find(c => c.code === "allowed_mate")?.slots.reply).toBe("Black's strongest reply is Qh4#.");
  expect(intent.claims.some(c => c.code === "reply_check")).toBe(false);
  expect(renderNeutral(intent).text.match(/Qh4#/g)).toHaveLength(1);

  // A missed mate describes an unplayed alternative, so the actual opponent's
  // checking reply remains a distinct supported fact.
  const missed = {...value, intelligence: {...value.intelligence!, events: [event("mate", {transition: "missed"})]}};
  expect(gameIntent({...args, report: missed}).claims.find(c => c.code === "reply_check")?.slots.reply).toBe("Qh4#");
  const ordinary = {...value, intelligence: {...value.intelligence!, events: []}};
  expect(gameIntent({...args, report: ordinary}).claims.find(c => c.code === "reply_check")?.slots.reply).toBe("Qh4#");
});

test("recorded relationships need the matching node and never follow a variation", () => {
  const value = report();
  const context: NonNullable<Game["context"]> = {version: "game-context-1", complete: false,
    input_digest: "context", total_plies: 1, missing_plies: [], limitations: [], biggest_swing_ply: null,
    nodes: [{ply: 1, actor: "white", before: value.best.score, after: value.actual.score,
      event_ids: [], input_digest: "facts", evidence: [ref]}], turning_points: [],
    relationships: [{id: "recovery", kind: "recovery", actor: "white", plies: [0, 1],
      event_ids: [], facts: {opponent_errors: [0]}, evidence: [ref]}]};
  const full = {...args, game: {...game, context}, report: value};
  expect(renderNeutral(gameIntent(full)).text).toMatch(/playable.*opponent's errors/i);
  expect(gameIntent(full).expression).toBe("recovered");
  expect(renderNeutral(gameIntent({...full, variation: true})).text).not.toMatch(/playable|recovered|opponent's errors/);
  const stale = {...context, nodes: []};
  expect(gameIntent({...full, game: {...game, context: stale}}).claims.some(c => c.code === "recovery")).toBe(false);
});

test("book is recognition, positive findings teach and arbitrary structure is not a cause", () => {
  const value = report();
  value.opening = {name: "Bongcloud", version: "openings"} as Report["opening"];
  value.label = "Book";
  const intent = gameIntent({...args, report: value});
  const text = renderNeutral(intent).text;
  expect(text).toContain("Bongcloud");
  expect(text).toContain("3.00 pawns");
  expect(text).not.toMatch(/recognition|does not mean|quality grade|sound/);
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
  expect(broken.text).toContain("don't have a clear explanation");
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
