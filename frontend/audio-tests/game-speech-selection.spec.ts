import {test, expect} from "@playwright/test";
import type {Schema} from "../src/api";
import type {Game, Position, Report} from "../src/gameReview/types";
import {gameIntent} from "../src/dialogue/gameIntent";
import {claim, makeIntent, type ClaimCode} from "../src/dialogue/model";
import {renderDialogue} from "../src/dialogue/neutral";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {distinctOpeners, selectGameRecording, type GameSpeechContext} from "../src/audio/speech/gameSelection";
import {semanticFixtures} from "../tests/semantic-fixtures";
import inventory from "../src/audio/speech/walter-dialogue-inventory.json" with {type: "json"};

type Detailed = Schema["GameReviewReport"];
const walter = {id: "classic", personality: storyteller};
const causal = semanticFixtures<{skill: string; black: boolean; report: Detailed}[]>("review_cause_fixtures.py");
const positional = semanticFixtures<{feature: string; code: string; mirrored: boolean; alternative: Detailed; actual: Detailed}[]>("review_position_fixtures.py");
const humans = semanticFixtures<Record<string, Game>>("review_human_fixtures.py");
const replyOnly = semanticFixtures<{report: Report; frame: Position}>("review_speech_fixtures.py");

function context(report: Report, after?: string): GameSpeechContext {
  const detailed = report as Detailed;
  const fen = after ?? detailed.actual_line?.frames[1]?.fen ?? report.board_cues?.fen ?? "6k1/8/8/q7/8/4N3/8/R5K1 b - - 1 1";
  const turn = fen.split(" ")[1] === "w" ? "white" : "black";
  const frame: Position = {fen, turn, san: report.actual.san, termination: null, result: null, legal_moves: []};
  const game = {frames: [{}, {...frame, actor: turn === "white" ? "black" : "white", report}],
    orientation: turn === "white" ? "black" : "white"} as unknown as Game;
  const intent = gameIntent({game, report, frame, ply: 1, key: "test-current-position", expression: "blunder"});
  return {game, frame, report, ply: 1, intent, utterance: renderDialogue(intent, walter)};
}
function rerender(current: GameSpeechContext): GameSpeechContext {
  const intent = gameIntent({...current, key: "test-current-position", expression: current.intent.expression});
  return {...current, intent, utterance: renderDialogue(intent, walter)};
}
function onlyClaim(current: GameSpeechContext, code: string): GameSpeechContext {
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
  expect(selectGameRecording(current)).toBe(id);
  expect(inventory.scripts.some(script => script.id === id)).toBe(true);
  expect(selectGameRecording({...current, variation: true,
    ...rerender({...current, variation: true})})).toBe(id);
  const changed = structuredClone(current);
  changed.report!.intelligence!.events.find(event => event.facts.motif === fixture.skill)!.actor = fixture.black ? "white" : "black";
  expect(selectGameRecording(changed)).toBeNull();
});

for (const fixture of positional) for (const line of ["actual", "alternative"] as const)
  test(`Walter preserves ${fixture.feature} ${line} scope (${fixture.mirrored ? "Black" : "White"})`, () => {
    const report = structuredClone(fixture[line]);
    // After an error the better move's pawn structure is never told: its own doubled
    // pawns are a drawback, and the alternative lines frame the opponent's as one too.
    if (line === "alternative" && fixture.feature === "doubled_files") {
      for (const side of ["white", "black"] as const) {
        for (const event of report.intelligence!.events)
          if (event.facts.feature === "doubled_files" && event.facts.line === "best") event.facts.side = side;
        expect(context(report).intent.claims.some(item => item.code === fixture.code)).toBe(false);
      }
      return;
    }
    const current = onlyClaim(context(report), fixture.code);
    const expected = `positional-${fixture.feature === "bishop_pair" ? "bishop-pair" : "doubled"}-${line}`;
    expect(selectGameRecording(current)).toBe(expected);
    const malformed = structuredClone(current);
    delete malformed.utterance.renderedClaims![0].position;
    expect(selectGameRecording(malformed)).toBeNull();
    const wrongActor = structuredClone(current);
    const source = wrongActor.utterance.renderedClaims![0].sourceIds[0];
    const event = wrongActor.report!.intelligence!.events.find(item => item.id === source)!;
    event.actor = event.actor === "white" ? "black" : "white";
    expect(selectGameRecording(wrongActor)).toBeNull();
  });

test("selection is exact rendered identity, not highest input priority, trace code or a supported fallback", () => {
  const current = context(causal[0].report);
  const item = current.utterance.renderedClaims![0];
  const intent = {...current.intent, claims: [claim("unrecognized" as ClaimCode, {}, 999), ...current.intent.claims]};
  const output = renderDialogue(intent, walter);
  expect(output.renderedClaims![0]).toEqual(item);
  expect(selectGameRecording({...current, intent, utterance: output})).toBe("cause-abandoned-defender");
  const unsupported = claim("compatibility", {detail: "A freeform legacy explanation."}, 999);
  const legacyIntent = {...current.intent, claims: [unsupported, ...current.intent.claims]};
  expect(selectGameRecording({...current, intent: legacyIntent, utterance: renderDialogue(legacyIntent, walter)})).toBeNull();
  const changed = structuredClone(current);
  changed.utterance.renderedClaims![0].slots.square = "h8";
  expect(selectGameRecording(changed)).toBeNull();
  expect(selectGameRecording({...current, utterance: {...current.utterance, renderedClaims: undefined}})).toBeNull();
  expect(selectGameRecording({...current, utterance: {...current.utterance, intentId: "old-intent"}})).toBeNull();
  // A coach without a recorded bank selects nothing unless asked for any coach.
  const unvoiced = {...current, utterance: {...current.utterance, coachId: "future-coach"}};
  expect(selectGameRecording(unvoiced)).toBeNull();
  expect(selectGameRecording({...unvoiced, anyCoach: true})).toBe("cause-abandoned-defender");
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
  expect(selectGameRecording({...current, pending: true})).toBeNull();
  expect(selectGameRecording({...current, error: true})).toBeNull();
  expect(selectGameRecording({...current, frame: {...current.frame!, fen: "another-position"}})).toBeNull();
  expect(selectGameRecording({...current, frame: {...current.frame!, san: "Kh2"}})).toBeNull();
  const changed = structuredClone(current);
  changed.report!.intelligence!.ply = 7;
  expect(selectGameRecording(changed)).toBeNull();
  const background = {...current, game: {...current.game, job: {status: "running"} as Game["job"]}};
  expect(selectGameRecording(background)).toBe("cause-abandoned-defender");
});

test("terminal checkmate comes from the current board result, never an expression or PGN result alone", () => {
  const current = context(causal[0].report);
  for (const orientation of ["white", "black"] as const) {
    const frame: Position = {...current.frame!, termination: "checkmate", result: "1-0", turn: "black"};
    const game = {...current.game, orientation, frames: [{}, frame] as Game["frames"]};
    const intent = gameIntent({game, frame, ply: 1, key: "mate", expression: orientation === "white" ? "winning" : "losing"});
    const terminal = {...current, game, frame, report: null, intent, utterance: renderDialogue(intent, walter)};
    expect(selectGameRecording(terminal)).toBe(orientation === "white" ? "mate-finished" : "mate-defense-ended");
    expect(selectGameRecording({...terminal, frame: {...frame, termination: "resignation"}})).toBeNull();
    expect(selectGameRecording({...terminal, frame: {...frame, result: "0-1"}})).toBeNull();
    expect(selectGameRecording({...terminal, frame: {...frame, legal_moves: [{from_square: "a1", to_square: "a2", capture: false, promotion: null}]}})).toBeNull();
  }
  expect(selectGameRecording({...current, game: {...current.game, result: "1-0"}})).toBe("cause-abandoned-defender");
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
    expect(selectGameRecording(human)).toBeNull();
    current.utterance.renderedClaims!.forEach((claim, claimIndex) => {
      if (claim.code === item.code) expect(selectGameRecording({...current, claimIndex})).toBeNull();
    });
    tested++;
  }
  expect(tested).toBeGreaterThan(0);
});

test("explicit secondary selection cannot narrate hidden claims or context inherited into a variation", () => {
  const current = context(causal[0].report);
  expect(selectGameRecording({...current, claimIndex: 99})).toBeNull();
  expect(selectGameRecording({...current, claimIndex: -1})).toBeNull();
  const recovery = claim("recovery", {earlier: "1. e4", help: ""}, 88,
    current.intent.claims[0].evidence, ["old-recovery"]);
  const intent = makeIntent("old-game-context", "recovery", "variation", "recovered", [recovery]);
  expect(selectGameRecording({...current, variation: true, intent, utterance: renderDialogue(intent, walter)})).toBeNull();
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
    expect(selectGameRecording(current), script.id).toBe(script.id);
    const wrongActor = structuredClone(current);
    wrongActor.report!.intelligence!.events[0].actor = event.actor === "white" ? "black" : "white";
    expect(selectGameRecording(rerender(wrongActor)), script.id).toBeNull();
    const ambiguous = structuredClone(current);
    ambiguous.report!.intelligence!.events.push(event);
    expect(selectGameRecording(ambiguous), script.id).toBeNull();
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
  expect(selectGameRecording(current)).toBe("positional-rook-open-actual");
  expect(selectGameRecording({...current, claimIndex: 1})).toBe("positional-rook-semi-open-actual");
  const mismatch = structuredClone(current);
  mismatch.utterance.renderedClaims![0].sourceIds = ["file-event-1"];
  expect(selectGameRecording(mismatch)).toBeNull();
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
    // After an error, the better move's line names only what it gains: the opponent's weaknesses.
    if (line === "best" && ["isolated", "doubled", "unsupported"].includes(example.name)) event.facts.side = "black";
    report.intelligence!.events = [event];
    if (line === "best" && ["king-flight", "isolated", "doubled"].includes(example.name)) {
      // A king square never explains an error, and the better move's pawn structure,
      // even the opponent's weakened pawns, is not told as an alternative.
      expect(context(report).intent.claims.some(item => item.code === example.code)).toBe(false);
      continue;
    }
    const current = onlyClaim(context(report), example.code);
    const id = `positional-${example.name}-${line === "actual" ? "actual" : "alternative"}`;
    expect(selectGameRecording(current), id).toBe(id);
    expect(inventory.scripts.some(script => script.id === id)).toBe(true);
    const invalid = structuredClone(current);
    invalid.report!.intelligence!.events[0].facts.side = "unknown";
    expect(selectGameRecording(invalid), id).toBeNull();
    const wrongLine = structuredClone(current);
    wrongLine.report!.intelligence!.events[0].facts.uci = "h1h8";
    expect(selectGameRecording(wrongLine), id).toBeNull();
  }
});

test("recorded-game recovery is tied to learner and current node generation", () => {
  const current = context(causal[0].report);
  current.report!.intelligence!.events = [];
  const evidence = [{source: "stockfish" as const, id: "recovery-search", field: "verified-sequence", ply: 1}];
  current.game.context = {version: "game-context-1", input_digest: "current-game", complete: true,
    limitations: [], missing_plies: [], total_plies: 1, biggest_swing_ply: null, turning_points: [],
    nodes: [{ply: 1, actor: "white", input_digest: current.report!.intelligence!.input_digest,
      before: current.report!.best.score, after: current.report!.actual.score, evidence, event_ids: []}],
    relationships: [{id: "recovery-now", kind: "recovery", actor: "white", plies: [0, 1],
      facts: {opponent_errors: [1]}, evidence, event_ids: []}]};
  const recovered = rerender(current);
  const told = (value: typeof recovered) => value.intent.claims.some(item => item.code === "recovery");
  expect(told(recovered)).toBe(true);
  // The opponent's errors helped, so the assisted take plays.
  expect(selectGameRecording(onlyClaim(recovered, "recovery"))).toBe("recovery-assisted");
  for (const change of ["actor", "generation", "endpoint"] as const) {
    const changed = structuredClone(current);
    if (change === "actor") changed.game.context!.relationships[0].actor = "black";
    if (change === "generation") changed.game.context!.nodes[0].input_digest = "old-generation";
    if (change === "endpoint") changed.game.context!.relationships[0].plies = [0, 9];
    expect(told(rerender(changed)), change).toBe(false);
  }
});

test("the chance-taken clip, some of whose takes call the reply exact, plays only on a top-graded move", () => {
  const current = context(causal[0].report);
  current.report!.intelligence!.events = [];
  const evidence = [{source: "stockfish" as const, id: "chance-search", field: "verified-sequence", ply: 1}];
  const actor = current.game.orientation;
  const takenWith = (label: Report["label"]) => {
    const changed = structuredClone(current);
    changed.report = {...changed.report!, label};
    changed.game.context = {version: "game-context-1", input_digest: "current-game", complete: true,
      limitations: [], missing_plies: [], total_plies: 1, biggest_swing_ply: null, turning_points: [],
      nodes: [{ply: 1, actor, input_digest: changed.report.intelligence!.input_digest,
        before: changed.report.best.score, after: changed.report.actual.score, evidence, event_ids: []}],
      relationships: [{id: "chance-now", kind: "punishment", actor, plies: [0, 1],
        facts: {outcome: "capitalized"}, evidence, event_ids: []}]};
    return selectGameRecording(onlyClaim(rerender(changed), "punishment"));
  };
  expect(takenWith("Best")).toBe("chance-taken");
  expect(takenWith("Good")).toBeNull();
});

test("the repeated-issue clip, whose takes never count occurrences, plays from the second occurrence on", () => {
  const current = context(causal[0].report);
  const evidence = [{source: "stockfish" as const, id: "repeat-search", field: "verified-sequence", ply: 1}];
  const actor = current.game.orientation;
  const repeatedAt = (occurrence: number) => {
    const changed = structuredClone(current);
    changed.game.context = {version: "game-context-1", input_digest: "current-game", complete: true,
      limitations: [], missing_plies: [], total_plies: 1, biggest_swing_ply: null, turning_points: [],
      nodes: [{ply: 1, actor, input_digest: changed.report!.intelligence!.input_digest,
        before: changed.report!.best.score, after: changed.report!.actual.score, evidence, event_ids: []}],
      relationships: [{id: "repeat-now", kind: "repeated_motif", actor, plies: [0, 1],
        facts: {role: "caused", motif: causal[0].skill, occurrence}, evidence, event_ids: []}]};
    return selectGameRecording(onlyClaim(rerender(changed), "repeated"));
  };
  expect(repeatedAt(2)).toBe("repeated-issue");
  expect(repeatedAt(3)).toBe("repeated-issue");
  expect(repeatedAt(5)).toBe("repeated-issue");
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
    expect(selectGameRecording(current)).toBe(expected);
    expect(selectGameRecording({...current, pending: true})).toBeNull();
    expect(selectGameRecording({...current, report: base.report})).toBeNull();
    const altered = structuredClone(current);
    altered.utterance.renderedClaims![0].slots.detail = "Unstructured text is not a fixed status.";
    expect(selectGameRecording(altered)).toBeNull();
    if (state === "unavailable") expect(selectGameRecording({...current, error: false})).toBeNull();
    if (state === "paused") expect(selectGameRecording({...current, game: {...game, job: null}})).toBeNull();
  }
});

test("Show why speaks a legal reply only when the producer marks the entire current caption as reply-only", () => {
  const {frame, report} = replyOnly;
  const game = {...context(report).game, frames: [{}, frame] as Game["frames"]};
  const intent = gameIntent({game, report, frame, ply: 1, explaining: true, key: "show-reply", expression: "explaining"});
  const current = {game, report, frame, ply: 1, intent, utterance: renderDialogue(intent, walter)};
  expect(selectGameRecording(current)).toBe("game-explanation-legal-reply");
  expect(selectGameRecording({...current, error: true})).toBeNull();
  expect(selectGameRecording({...current, pending: true})).toBeNull();
  expect(selectGameRecording({...current, frame: {...frame, legal_moves: []}})).toBeNull();
  for (const change of ["legacy", "reply", "fen"] as const) {
    const changed = structuredClone(current);
    if (change === "legacy") delete changed.report.board_cues!.caption_kind;
    if (change === "reply") changed.report.board_cues!.caption_reply_uci = "a1a8";
    if (change === "fen") changed.report.board_cues!.fen = "old-position";
    expect(selectGameRecording(changed)).toBeNull();
  }
  const finding = context(causal[0].report);
  const findingIntent = gameIntent({...finding, key: "finding-show-why", explaining: true, expression: "explaining"});
  expect(finding.report!.board_cues!.caption_kind).toBeNull();
  expect(selectGameRecording({...finding, intent: findingIntent, utterance: renderDialogue(findingIntent, walter)})).toBeNull();
});

test("a joined pair never repeats the coach's opening catchphrase", () => {
  const lines: Record<string, string> = {
    fork: "Whoa, a fork for the other side.", capture: "Whoa, a capture is ready.",
    "capture-2": "Something can be taken at once.", check: "The reply gives check.",
  };
  const text = (id: string) => lines[id];
  expect(distinctOpeners("fork+capture|capture-2", text)).toBe("fork+capture-2");
  // With no other recorded take the first line plays alone.
  expect(distinctOpeners("fork+capture", text)).toBe("fork");
  expect(distinctOpeners("fork+check", text)).toBe("fork+check");
  // A first sentence with no short catchphrase never filters anything.
  expect(distinctOpeners("check+capture", text)).toBe("check+capture");
  // A "Label:" inside both lines counts as the same catchphrase.
  const labelled: Record<string, string> = {first: "A fork is coming. Notebook rule: check every square.",
    second: "Pawns share a file. Notebook rule: count them.", other: "Pawns share a file."};
  expect(distinctOpeners("first+second|other", id => labelled[id])).toBe("first+other");
});
