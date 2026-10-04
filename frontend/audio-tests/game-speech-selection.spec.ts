import {test, expect} from "@playwright/test";
import type {Schema} from "../src/api";
import type {Game, Position, Report} from "../src/gameReview/types";
import {gameIntent} from "../src/dialogue/gameIntent";
import {claim, makeIntent} from "../src/dialogue/model";
import {renderDialogue} from "../src/dialogue/neutral";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {selectWalterGameRecording, type WalterGameSpeechContext} from "../src/audio/speech/gameSelection";
import {semanticFixtures} from "../tests/semantic-fixtures";
import inventory from "../src/audio/speech/walter-dialogue-inventory.json" with {type: "json"};

type Detailed = Schema["GameReviewReport"];
const walter = {id: "classic", personality: storyteller};
const causal = semanticFixtures<{skill: string; black: boolean; report: Detailed}[]>("review_cause_fixtures.py");
const positional = semanticFixtures<{feature: string; code: string; mirrored: boolean; alternative: Detailed; actual: Detailed}[]>("review_position_fixtures.py");
const humans = semanticFixtures<Record<string, Game>>("review_human_fixtures.py");
const replyOnly = semanticFixtures<{report: Report; frame: Position}>("review_speech_fixtures.py");

function context(report: Report, after?: string): WalterGameSpeechContext {
  const detailed = report as Detailed;
  const fen = after ?? detailed.actual_line?.frames[1]?.fen ?? report.board_cues?.fen ?? "6k1/8/8/q7/8/4N3/8/R5K1 b - - 1 1";
  const turn = fen.split(" ")[1] === "w" ? "white" : "black";
  const frame: Position = {fen, turn, san: report.actual.san, termination: null, result: null, legal_moves: []};
  const game = {frames: [{}, {...frame, actor: turn === "white" ? "black" : "white", report}],
    orientation: turn === "white" ? "black" : "white"} as unknown as Game;
  const intent = gameIntent({game, report, frame, ply: 1, key: "test-current-position", expression: "blunder"});
  return {game, frame, report, ply: 1, intent, utterance: renderDialogue(intent, walter)};
}
function rerender(current: WalterGameSpeechContext): WalterGameSpeechContext {
  const intent = gameIntent({...current, key: "test-current-position", expression: current.intent.expression});
  return {...current, intent, utterance: renderDialogue(intent, walter)};
}
function onlyClaim(current: WalterGameSpeechContext, code: string): WalterGameSpeechContext {
  const item = current.intent.claims.find(candidate => candidate.code === code)!;
  expect(item).toBeTruthy();
  const intent = {...current.intent, claims: [item]};
  return {...current, intent, utterance: renderDialogue(intent, walter)};
}

for (const fixture of causal) test(`Walter selects ${fixture.skill} for ${fixture.black ? "Black" : "White"} from the actual rendered causal claim`, () => {
  const report = structuredClone(fixture.report);
  report.intelligence!.events = report.intelligence!.events.filter(event => event.facts.motif === fixture.skill);
  const current = context(report);
  const id = `cause-${fixture.skill.replaceAll("_", "-")}`;
  expect(selectWalterGameRecording(current)).toBe(id);
  expect(inventory.scripts.some(script => script.id === id)).toBe(true);
  expect(selectWalterGameRecording({...current, variation: true,
    ...rerender({...current, variation: true})})).toBe(id);
  const changed = structuredClone(current);
  changed.report!.intelligence!.events.find(event => event.facts.motif === fixture.skill)!.actor = fixture.black ? "white" : "black";
  expect(selectWalterGameRecording(changed)).toBeNull();
});

for (const fixture of positional) for (const line of ["actual", "alternative"] as const)
  test(`Walter preserves ${fixture.feature} ${line} scope (${fixture.mirrored ? "Black" : "White"})`, () => {
    const current = onlyClaim(context(fixture[line]), fixture.code);
    const expected = `positional-${fixture.feature === "bishop_pair" ? "bishop-pair" : "doubled"}-${line}`;
    expect(selectWalterGameRecording(current)).toBe(expected);
    const malformed = structuredClone(current);
    delete malformed.utterance.renderedClaims![0].position;
    expect(selectWalterGameRecording(malformed)).toBeNull();
    const wrongActor = structuredClone(current);
    const source = wrongActor.utterance.renderedClaims![0].sourceIds[0];
    const event = wrongActor.report!.intelligence!.events.find(item => item.id === source)!;
    event.actor = event.actor === "white" ? "black" : "white";
    expect(selectWalterGameRecording(wrongActor)).toBeNull();
  });

test("selection is exact rendered identity, not highest input priority, trace code or a supported fallback", () => {
  const current = context(causal[0].report);
  const item = current.utterance.renderedClaims![0];
  const intent = {...current.intent, claims: [claim("unrecognized", {}, 999), ...current.intent.claims]};
  const output = renderDialogue(intent, walter);
  expect(output.renderedClaims![0]).toEqual(item);
  expect(selectWalterGameRecording({...current, intent, utterance: output})).toBe("cause-abandoned-defender");
  const unsupported = claim("compatibility", {detail: "A freeform legacy explanation."}, 999);
  const legacyIntent = {...current.intent, claims: [unsupported, ...current.intent.claims]};
  expect(selectWalterGameRecording({...current, intent: legacyIntent, utterance: renderDialogue(legacyIntent, walter)})).toBeNull();
  const changed = structuredClone(current);
  changed.utterance.renderedClaims![0].slots.square = "h8";
  expect(selectWalterGameRecording(changed)).toBeNull();
  expect(selectWalterGameRecording({...current, utterance: {...current.utterance, renderedClaims: undefined}})).toBeNull();
  expect(selectWalterGameRecording({...current, utterance: {...current.utterance, coachId: "cat-kitten"}})).toBeNull();
  expect(selectWalterGameRecording({...current, utterance: {...current.utterance, intentId: "old-intent"}})).toBeNull();
});

test("rendered claims snapshot the selected source and slots without aliasing producer state", () => {
  const item = claim("reply_capture", {opponent: "Black", reply: "Qxa1", piece: "rook", side: "White"}, 70,
    [{source: "stockfish", id: "selected-search", field: "candidate_search"}], ["selected-event"]);
  const intent = makeIntent("identity", "mistake", "game", "mistake", [item]);
  const utterance = renderDialogue(intent, walter);
  item.slots.reply = "Nf6";
  item.evidence[0].id = "other-search";
  item.sourceIds[0] = "other-event";
  expect(utterance.renderedClaims![0].slots.reply).toBe("Qxa1");
  expect(utterance.renderedClaims![0].evidence[0].id).toBe("selected-search");
  expect(utterance.renderedClaims![0].sourceIds).toEqual(["selected-event"]);
});

test("stale positions, current errors and unresolved position requests remain silent; background refinement does not", () => {
  const current = context(causal[0].report);
  expect(selectWalterGameRecording({...current, pending: true})).toBeNull();
  expect(selectWalterGameRecording({...current, error: true})).toBeNull();
  expect(selectWalterGameRecording({...current, frame: {...current.frame!, fen: "another-position"}})).toBeNull();
  expect(selectWalterGameRecording({...current, frame: {...current.frame!, san: "Kh2"}})).toBeNull();
  const changed = structuredClone(current);
  changed.report!.intelligence!.ply = 7;
  expect(selectWalterGameRecording(changed)).toBeNull();
  const background = {...current, game: {...current.game, job: {status: "running"} as Game["job"]}};
  expect(selectWalterGameRecording(background)).toBe("cause-abandoned-defender");
});

test("terminal checkmate comes from the current board result, never an expression or PGN result alone", () => {
  const current = context(causal[0].report);
  for (const orientation of ["white", "black"] as const) {
    const frame: Position = {...current.frame!, termination: "checkmate", result: "1-0", turn: "black"};
    const game = {...current.game, orientation, frames: [{}, frame] as Game["frames"]};
    const intent = gameIntent({game, frame, ply: 1, key: "mate", expression: orientation === "white" ? "winning" : "losing"});
    const terminal = {...current, game, frame, report: null, intent, utterance: renderDialogue(intent, walter)};
    expect(selectWalterGameRecording(terminal)).toBe(orientation === "white" ? "mate-finished" : "mate-defense-ended");
    expect(selectWalterGameRecording({...terminal, frame: {...frame, termination: "resignation"}})).toBeNull();
    expect(selectWalterGameRecording({...terminal, frame: {...frame, result: "0-1"}})).toBeNull();
    expect(selectWalterGameRecording({...terminal, frame: {...frame, legal_moves: [{from_square: "a1", to_square: "a2", capture: false, promotion: null}]}})).toBeNull();
  }
  expect(selectWalterGameRecording({...current, game: {...current.game, result: "1-0"}})).toBe("cause-abandoned-defender");
});

test("a Maia claim never selects a recording, even with exact current learner evidence", () => {
  let tested = 0;
  for (const game of Object.values(humans)) {
    const report = game.frames[1].report!;
    const current = context(report, game.frames[1].fen);
    // The coach's own intent never carries Maia; only the badge's intent does.
    expect(current.intent.claims.some(item => item.code.startsWith("human_") || item.code === "difficult_defense")).toBe(false);
    const badge = gameIntent({...current, key: "test-current-position", expression: current.intent.expression, human: true});
    const item = badge.claims.find(item => item.code.startsWith("human_") || item.code === "difficult_defense");
    if (!item) continue;
    const intent = makeIntent(`${current.intent.id}:human`, current.intent.purpose, current.intent.mode,
      current.intent.expression, [item], current.intent.decisions, current.intent.subject);
    const human = {...current, intent, utterance: renderDialogue(intent, walter)};
    expect(human.utterance.renderedClaims!.map(claim => claim.code)).toEqual([item.code]);
    expect(selectWalterGameRecording(human)).toBeNull();
    current.utterance.renderedClaims!.forEach((claim, claimIndex) => {
      if (claim.code === item.code) expect(selectWalterGameRecording({...current, claimIndex})).toBeNull();
    });
    tested++;
  }
  expect(tested).toBeGreaterThan(0);
});

test("explicit secondary selection cannot narrate hidden claims or context inherited into a variation", () => {
  const current = context(causal[0].report);
  expect(selectWalterGameRecording({...current, claimIndex: 99})).toBeNull();
  expect(selectWalterGameRecording({...current, claimIndex: -1})).toBeNull();
  const recovery = claim("recovery", {earlier: "1. e4", help: ""}, 88,
    current.intent.claims[0].evidence, ["old-recovery"]);
  const intent = makeIntent("old-game-context", "recovery", "variation", "recovered", [recovery]);
  expect(selectWalterGameRecording({...current, variation: true, intent, utterance: renderDialogue(intent, walter)})).toBeNull();
});

test("every tactical recording keeps its exact motif, actor and line role", () => {
  const scripts = inventory.scripts.filter(script => script.family === "tactics");
  for (const script of scripts) {
    const role = "role" in script ? script.role : "";
    const motif = "motif" in script ? script.motif : "";
    const report = structuredClone(causal[0].report);
    if (role === "played") report.label = report.engine_label = "Best";
    const original = report.intelligence!.events.find(event => event.facts.role === "allowed")!;
    // Played and missed witnesses start on the move itself; allowed ones on the reply.
    const opening = role === "allowed" ? original.facts.witness
      : [{ply: 1, san: report[role === "missed" ? "best" : "actual"].san, capture: null, gives_check: false}];
    const event = {...original, id: script.id, actor: role === "allowed" ? "black" as const : "white" as const,
      facts: {...original.facts, motif, role, ...(role === "allowed" ? {} : {plies: [1], frame_ply: 1, witness: opening})},
      evidence: original.evidence.map(ref => ref.source === "stockfish"
        ? {...ref, field: `${role === "missed" ? "best" : "actual"}_line/findings/0`} : ref)};
    report.intelligence!.events = [event];
    const current = context(report);
    expect(selectWalterGameRecording(current), script.id).toBe(script.id);
    const wrongActor = structuredClone(current);
    wrongActor.report!.intelligence!.events[0].actor = event.actor === "white" ? "black" : "white";
    expect(selectWalterGameRecording(rerender(wrongActor)), script.id).toBeNull();
    const ambiguous = structuredClone(current);
    ambiguous.report!.intelligence!.events.push(event);
    expect(selectWalterGameRecording(ambiguous), script.id).toBeNull();
  }
});

test("same-code rendered claims retain distinct event identity and selected positional scope", () => {
  const report = structuredClone(causal[0].report);
  report.label = report.engine_label = "Best";
  const source = report.intelligence!.events.find(event => event.kind === "positional" && event.facts.line === "actual")!;
  report.intelligence!.events = ["open", "semi_open"].map((after, index) => ({...source, id: `file-event-${index}`,
    facts: {feature: "rook_file", side: "white", before: "closed", after, file: index ? "d" : "e", line: "actual", uci: report.actual.uci}}));
  const current = context(report);
  expect(current.utterance.renderedClaims).toHaveLength(2);
  expect(current.utterance.renderedClaims!.map(item => item.code)).toEqual(["rook_file", "rook_file"]);
  expect(selectWalterGameRecording(current)).toBe("positional-rook-open-actual");
  expect(selectWalterGameRecording({...current, claimIndex: 1})).toBe("positional-rook-semi-open-actual");
  const mismatch = structuredClone(current);
  mismatch.utterance.renderedClaims![0].sourceIds = ["file-event-1"];
  expect(selectWalterGameRecording(mismatch)).toBeNull();
});

test("all positional speech branches validate their structured facts and keep alternative wording", () => {
  const cases: {code: string; name: string; facts: Schema["ReviewEvent"]["facts"]}[] = [
    {code: "development", name: "development", facts: {feature: "first_development", piece: "knight", before: "c2", after: "e3"}},
    {code: "rook_file", name: "rook-open", facts: {feature: "rook_file", before: "closed", after: "open", file: "c"}},
    {code: "rook_file", name: "rook-semi-open", facts: {feature: "rook_file", before: "closed", after: "semi_open", file: "c"}},
    {code: "passed", name: "passed", facts: {feature: "passed_pawns", added: ["c5"]}},
    {code: "passer_advance", name: "passer-advance", facts: {feature: "passed_pawn_advance", before: "c5", after: "c6"}},
    {code: "isolated", name: "isolated", facts: {feature: "isolated_pawns", added: ["c5"]}},
    {code: "support", name: "support", facts: {feature: "piece_support", before: [], after: ["c2"], piece: "rook", target: "a1", attacked: true}},
    {code: "unsupported", name: "unsupported", facts: {feature: "piece_support", before: ["c2"], after: [], piece: "rook", target: "a1", attacked: true}},
    {code: "flights", name: "king-flight", facts: {feature: "king_flights", opened: ["g2"]}},
    {code: "castle", name: "castling", facts: {feature: "castling", before: "e1", after: "g1"}},
    {code: "bishops", name: "bishop-pair", facts: {feature: "bishop_pair", before: 2, after: 1, side: "black"}},
    {code: "doubled", name: "doubled", facts: {feature: "doubled_files", before: [], after: ["c"], added: ["c"]}},
  ];
  for (const example of cases) for (const line of ["actual", "best"] as const) {
    const report = structuredClone(causal[0].report);
    if (line === "actual") report.label = report.engine_label = "Best";
    const original = report.intelligence!.events.find(event => event.kind === "positional")!;
    const event = {...original, id: `position-${line}-${example.name}`,
      facts: {side: "white", ...example.facts, line, uci: report[line].uci},
      evidence: [...original.evidence, {source: "pgn" as const, id: "pgn-history", field: "original_minor_piece_history"}]};
    report.intelligence!.events = [event];
    const current = onlyClaim(context(report), example.code);
    const id = `positional-${example.name}-${line === "actual" ? "actual" : "alternative"}`;
    expect(selectWalterGameRecording(current), id).toBe(id);
    expect(inventory.scripts.some(script => script.id === id)).toBe(true);
    const invalid = structuredClone(current);
    invalid.report!.intelligence!.events[0].facts.side = "unknown";
    expect(selectWalterGameRecording(invalid), id).toBeNull();
    const wrongLine = structuredClone(current);
    wrongLine.report!.intelligence!.events[0].facts.uci = "h1h8";
    expect(selectWalterGameRecording(wrongLine), id).toBeNull();
  }
});

test("recorded-game recovery is tied to learner, current node generation and assistance facts", () => {
  const current = context(causal[0].report);
  current.report!.intelligence!.events = [];
  const evidence = [{source: "stockfish" as const, id: "recovery-search", field: "verified-sequence", ply: 1}];
  current.game.context = {version: "game-context-1", input_digest: "current-game", complete: true,
    limitations: [], missing_plies: [], total_plies: 1, biggest_swing_ply: null, turning_points: [],
    nodes: [{ply: 1, actor: "white", input_digest: current.report!.intelligence!.input_digest,
      before: current.report!.best.score, after: current.report!.actual.score, evidence, event_ids: []}],
    relationships: [{id: "recovery-now", kind: "recovery", actor: "white", plies: [0, 1],
      facts: {opponent_errors: []}, evidence, event_ids: []}]};
  const recovered = rerender(current);
  expect(selectWalterGameRecording(recovered)).toBe("recovery");
  const assisted = structuredClone(recovered);
  assisted.game.context!.relationships[0].facts.opponent_errors = [1];
  expect(selectWalterGameRecording(rerender(assisted))).toBe("recovery-assisted");
  expect(selectWalterGameRecording(assisted)).toBeNull();
  for (const change of ["actor", "generation", "endpoint"] as const) {
    const changed = structuredClone(recovered);
    if (change === "actor") changed.game.context!.relationships[0].actor = "black";
    if (change === "generation") changed.game.context!.nodes[0].input_digest = "old-generation";
    if (change === "endpoint") changed.game.context!.relationships[0].plies = [0, 9];
    expect(selectWalterGameRecording(changed)).toBeNull();
  }
  expect(selectWalterGameRecording({...recovered, variation: true, intent: {...recovered.intent, mode: "variation"}})).toBeNull();
});

test("finite no-report status recordings are manual-only and never authorize legacy prose or stale analysis", () => {
  const base = context(causal[0].report);
  for (const variation of [false, true]) for (const state of ["unavailable", "paused", "browse"] as const) {
    const frame: Position = {...base.frame!, san: null};
    const game = {...base.game, frames: [{...frame, actor: null}] as Game["frames"],
      job: {status: state === "paused" ? "cancelled" : "completed"} as Game["job"]};
    const error = state === "unavailable";
    const intent = gameIntent({game, frame, ply: 0, variation, error, key: "manual-status", expression: "neutral"});
    const current = {...base, report: null, game, frame, ply: 0, variation, error, intent, utterance: renderDialogue(intent, walter)};
    expect(current.utterance.autoSpeakSuitable).toBe(false);
    const expected = state === "unavailable" ? "game-unavailable" : state === "paused" ? "game-review-paused" : "game-browse-instructions";
    expect(selectWalterGameRecording(current)).toBe(expected);
    expect(selectWalterGameRecording({...current, pending: true})).toBeNull();
    expect(selectWalterGameRecording({...current, report: base.report})).toBeNull();
    const altered = structuredClone(current);
    altered.utterance.renderedClaims![0].slots.detail = "Unstructured text is not a fixed status.";
    expect(selectWalterGameRecording(altered)).toBeNull();
    if (state === "unavailable") expect(selectWalterGameRecording({...current, error: false})).toBeNull();
    if (state === "paused") expect(selectWalterGameRecording({...current, game: {...game, job: null}})).toBeNull();
  }
});

test("Show why speaks a legal reply only when the producer marks the entire current caption as reply-only", () => {
  const {frame, report} = replyOnly;
  const game = {...context(report).game, frames: [{}, frame] as Game["frames"]};
  const intent = gameIntent({game, report, frame, ply: 1, explaining: true, key: "show-reply", expression: "explaining"});
  const current = {game, report, frame, ply: 1, intent, utterance: renderDialogue(intent, walter)};
  expect(selectWalterGameRecording(current)).toBe("game-explanation-legal-reply");
  expect(selectWalterGameRecording({...current, error: true})).toBeNull();
  expect(selectWalterGameRecording({...current, pending: true})).toBeNull();
  expect(selectWalterGameRecording({...current, frame: {...frame, legal_moves: []}})).toBeNull();
  for (const change of ["legacy", "reply", "fen"] as const) {
    const changed = structuredClone(current);
    if (change === "legacy") delete changed.report.board_cues!.caption_kind;
    if (change === "reply") changed.report.board_cues!.caption_reply_uci = "a1a8";
    if (change === "fen") changed.report.board_cues!.fen = "old-position";
    expect(selectWalterGameRecording(changed)).toBeNull();
  }
  const finding = context(causal[0].report);
  const findingIntent = gameIntent({...finding, key: "finding-show-why", explaining: true, expression: "explaining"});
  expect(finding.report!.board_cues!.caption_kind).toBeNull();
  expect(selectWalterGameRecording({...finding, intent: findingIntent, utterance: renderDialogue(findingIntent, walter)})).toBeNull();
});
