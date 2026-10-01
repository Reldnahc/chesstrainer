import {test, expect} from "@playwright/test";
import type {Schema} from "../src/api";
import {tacticalClaim} from "../src/dialogue/eventClaims";
import {claim, makeIntent, type Claim} from "../src/dialogue/model";
import {renderDialogue} from "../src/dialogue/neutral";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {neutralPersonality} from "../src/dialogue/personality";
import {gameIntent} from "../src/dialogue/gameIntent";
import {practiceIntent} from "../src/dialogue/practiceIntent";
import type {Game, Position, Report} from "../src/gameReview/types";
import {semanticFixtures} from "./semantic-fixtures";
import {humanInsightIntent} from "../src/dialogue/humanClaims";
import {tacticalPresentation} from "../src/dialogue/tacticalTemplates";

const walter = {id: "classic", personality: storyteller};
const ref = {source: "stockfish" as const, id: "search", field: "actual_line/findings/0"};
function event(role = "played", changes: Schema["ReviewEvent"]["facts"] = {}): Schema["ReviewEvent"] {
  const ply = role === "allowed" ? 2 : 1;
  return {id: "fork-witness", actor: "white", confidence: "line_witness", importance: 75, kind: "tactic", evidence: [ref],
    facts: {role, motif: "fork", frame_ply: ply, plies: [ply], witness: [{ply, san: "Ng5+", capture: null}],
      roles: {targets: ["h7", "e4"]}, pieces: {h7: {color: "black", piece: "king"}, e4: {color: "black", piece: "queen"}}, ...changes}};
}
function render(item: Claim, subject: "learner" | "opponent" = "learner") {
  return renderDialogue(makeIntent("scope", "best", "game", "best", [item], [], subject), walter);
}
const build = (value: Schema["ReviewEvent"]) => tacticalClaim(value, "Ng5+", "Ng5+", value.actor === "white" ? "White" : "Black")!;

const fixtures = semanticFixtures<{scenario: string; black: boolean; report: Report}[]>("review_tactical_scope_fixtures.py");
for (const {scenario, black, report} of fixtures) test(`legal ${scenario}, ${black ? "Black" : "White"}: production evidence reaches Walter with honest scope`, () => {
  const intent = gameIntent({game: {frames: [], orientation: black ? "black" : "white"} as unknown as Game, report,
    frame: {turn: black ? "white" : "black"} as Position, ply: 1, key: `legal:${scenario}:${black}`, expression: "best"});
  if (scenario === "root_capture") {
    const captured = intent.claims.find(item => item.slots.motif === "undefended capture")!;
    expect(captured.tactic?.timing).toBe("possible");
    const output = renderDialogue({...intent, claims: [captured]}, walter);
    expect(output.text).toContain(`${report.actual.san} captures a queen`);
    expect(output.text).not.toMatch(/follow-up|possibility|would capture/);
    expect(output.renderedClaims?.[0].sourceIds).toEqual(captured.sourceIds);
    return;
  }
  const fork = intent.claims.find(item => item.slots.motif === "fork")!;
  expect(fork).toBeTruthy();
  expect(fork.tactic?.effect.kind).toBe("fork");
  const output = renderDialogue({...intent, claims: [fork]}, walter);
  const event = report.intelligence!.events.find(value => value.id === fork.sourceIds[0])!;
  expect(output.renderedClaims?.[0].sourceIds).toEqual([event.id]);
  expect(output.renderedClaims?.[0].evidence).toEqual(event.evidence);
  if (scenario === "played_fork") {
    expect(output.text).toContain(`After ${report.actual.san}`);
    expect(output.text).toContain("are attacked together");
  } else {
    expect(output.text).toContain("would be attacked together");
    expect(output.text).not.toContain("are attacked together");
    if (scenario === "missed_fork") expect(output.text).toContain(`With ${report.best.san}, there would be`);
    if (scenario === "allowed_fork") expect(output.text).toContain(`${black ? "White" : "Black"} can reply with`);
    if (scenario === "collected_fork") expect(output.text).toContain("if the replies allow it");
  }
  expect(output.text).not.toMatch(/continuation|verified|search|engine/i);
});

test("Walter states a witnessed root fork without turning a future opportunity into a board fact", () => {
  const current = build(event());
  const future = build(event("played", {plies: [1, 3], witness: [{ply: 1, san: "Ng5+"}, {ply: 3, san: "Nxe4", capture: "queen"}]}));
  expect(current.tactic?.timing).toBe("immediate");
  expect(future.tactic?.timing).toBe("possible");
  const actual = render(current), possible = render(future);
  expect(actual.text).toContain("After Ng5+");
  expect(actual.text).toContain("king on h7 and queen on e4 are attacked together");
  expect(possible.text).toContain("if the replies allow it");
  expect(possible.text).toContain("king on h7 and queen on e4 would be attacked together");
  expect(possible.text).not.toMatch(/happens later|are attacked|wins material/);
  for (const output of [actual, possible]) expect(output.text).not.toMatch(/continuation|verified|engine|search/i);
  expect(actual.renderedClaims).toEqual([current]);
  expect(actual.trace.variants[0].sourceIds).toEqual(["fork-witness"]);
  expect(actual.trace.variants[0].code).toBe("tactic_played");
});

for (const actor of ["white", "black"] as const) test(`Walter separates an unplayed fork from an immediate ${actor} reply`, () => {
  const missed = render(build(event("missed")));
  expect(missed.text).toMatch(/With Ng5\+, there would be a fork/);
  expect(missed.text).toContain("would be attacked together");
  expect(missed.text).not.toContain("are attacked together");
  const allowed = event("allowed");
  allowed.actor = actor;
  allowed.facts.pieces = {h7: {color: actor === "white" ? "black" : "white", piece: "king"}, e4: {color: actor === "white" ? "black" : "white", piece: "queen"}};
  const reply = render(build(allowed));
  expect(reply.text).toContain(`${actor === "white" ? "White" : "Black"} can reply with Ng5+, with a fork`);
  expect(reply.text).toContain("would be attacked together");
});

for (const [name, changes] of Object.entries({
  "missing plies": {plies: undefined}, "reference board alone": {plies: [], witness: []},
  "wrong reference board": {frame_ply: 3}, "mismatched witness": {witness: [{ply: 2, san: "Ng5+"}]},
  "wrong root move": {witness: [{ply: 1, san: "Ng1"}]},
  "non-integer ply": {plies: [1.1], frame_ply: 1.1, witness: [{ply: 1.1, san: "Ng5+"}]},
})) test(`Walter does not assert immediate effects from ${name}`, () => {
  const value = render(build(event("played", changes)));
  expect(value.text).toContain("if the replies allow it");
  expect(value.text).toContain("would be attacked together");
});

test("a pin witnessed on the current board is not claimed to have been created by the move", () => {
  const value = render(build(event("played", {motif: "pin", roles: {}, pieces: {}})));
  expect(value.text).toContain("After Ng5+, there is a pin");
  expect(value.text).not.toMatch(/creates|pins|new pin|wins/);
});

test("finite-PV material gains remain conditional, separate from motif causation or an overall material lead", () => {
  for (const role of ["played", "allowed", "missed"]) {
    const value = render(build(event(role, {motif: "pin", settled_material_delta: 1})));
    expect(value.text).toContain("There may be a material gain, though both sides still have choices to make");
    expect(value.text).not.toMatch(/wins material|ahead in material|forced|guaranteed|pin wins/);
  }
});

test("capture descriptions preserve actual, alternative, reply and uncertain timing", () => {
  const capture = (role: string, ply: number) => build(event(role, {motif: "hanging_piece", frame_ply: ply, plies: [ply],
    witness: [{ply, san: "Ng5+", capture: "queen"}]}));
  expect(render(capture("played", 1)).text).toContain("Ng5+ captures a queen");
  expect(render(capture("missed", 1)).text).toContain("Ng5+ would capture a queen");
  expect(render(capture("allowed", 2)).text).toContain("Ng5+ would capture a queen");
  expect(render(capture("played", 3)).text).toContain("One possible follow-up is Ng5+, capturing a queen");
  for (const role of ["played", "missed", "allowed"]) {
    const ply = role === "allowed" ? 2 : 1;
    const item = build(event(role, {motif: "hanging_piece", frame_ply: ply - 1,
      witness: [{ply, san: "Ng5+", capture: "queen"}]}));
    expect(item.tactic?.timing).toBe("possible");
    const output = render(item);
    expect(output.text).toContain(role === "played" ? "Ng5+ captures a queen" : "Ng5+ would capture a queen");
    expect(output.text).not.toContain("One possible follow-up is Ng5+");
    if (role === "played") expect(output.text).not.toContain("possibility to watch for after Ng5+");
  }
});

test("Walter's opponent facts get accurate timing without personal praise", () => {
  const output = render(build(event()), "opponent");
  expect(output.text).toContain("king on h7 and queen on e4 are attacked together");
  expect(output.trace.variants[0].source).toBe(storyteller.version);
  expect(output.trace.composition?.strategy).toBe("minimal");
  expect(output.text).not.toMatch(/you|well judged|nicely|worth noticing|continuation/i);
});

test("scope cannot be hidden in optional character framing or discarded by a custom form", () => {
  const item = build(event("missed"));
  const intent = makeIntent("scope-guard", "missed", "game", "missed", [item]);
  const code = tacticalPresentation(item)!.code;
  const unsafe = {id: "unsafe", personality: {...storyteller, templates: {[code]: [
    {fact: "The {targets} would be attacked together.", observation: "With {best}, there would be a {motif}."},
  ]}}};
  const output = renderDialogue(intent, unsafe);
  expect(output.trace.variants[0].source).toBe("tactical-scoped-2");
  expect(output.text).toContain("With Ng5+, there would be a fork");
});

test("new witness scope changes intent identity while preserving unchanged coaches' text variants", () => {
  const current = build(event());
  const {tactic: _tactic, ...original} = current;
  const oldIntent = makeIntent("stable", "best", "game", "best", [original]);
  const newIntent = makeIntent("stable", "best", "game", "best", [current]);
  const changedIntent = makeIntent("stable", "best", "game", "best", [{...current, tactic: {...current.tactic!, timing: "possible"}}]);
  expect(newIntent.id).not.toBe(oldIntent.id);
  expect(changedIntent.id).not.toBe(newIntent.id);
  expect(newIntent.wordingKey).toBe(oldIntent.id);
  const other = {id: "other", personality: {...neutralPersonality, version: "unchanged-1", templates: {
    tactic_played: ["{move} has a {motif}. {detail}", "Consider {move} and its {motif}. {detail}"]}}};
  expect(renderDialogue(newIntent, other).text).toBe(renderDialogue(oldIntent, other).text);
  expect(renderDialogue(newIntent, {id: "neutral"}).text).toBe(renderDialogue(oldIntent, {id: "neutral"}).text);
  const saved = JSON.stringify(newIntent);
  renderDialogue(newIntent, walter);
  expect(JSON.stringify(newIntent)).toBe(saved);
});

test("derived human insight preserves its own factual identity and the parent legacy wording seed", () => {
  const item = build(event()), human = claim("human_natural_error", {}, 69, [{source: "human", id: "maia", field: "policy"}]);
  const {tactic: _tactic, ...original} = item;
  const before = humanInsightIntent(makeIntent("parent", "mistake", "game", "mistake", [original, human]));
  const after = humanInsightIntent(makeIntent("parent", "mistake", "game", "mistake", [item, human]));
  expect(after.id).not.toBe(before.id);
  expect(after.wordingKey).toBe(before.id);
  expect(after.claims).toEqual([human]);
  expect(renderDialogue(after, {id: "neutral"}).text).toBe(renderDialogue(before, {id: "neutral"}).text);
  const changed = humanInsightIntent(makeIntent("parent", "mistake", "game", "mistake", [item, {...human, evidence: [{source: "human", id: "maia-revised", field: "policy"}]}]));
  expect(changed.id).not.toBe(after.id);
  expect(changed.wordingKey).not.toBe(after.wordingKey);
});

test("the generic strong-move fallback does not claim literal Best for Brilliant or Great", () => {
  for (const label of ["Best", "Great", "Brilliant"] as const) {
    const score = {kind: "cp" as const, value: 20, mate_given: false};
    const report = {label, engine_label: label, actual: {san: "e4", uci: "e2e4", score}, best: {san: "d4", uci: "d2d4", score},
      intelligence: {events: [], limitations: []}} as unknown as Report;
    const intent = gameIntent({game: {frames: [], orientation: "white"} as unknown as Game, report,
      frame: {turn: "black"} as Position, ply: 1, key: "strong", expression: label.toLowerCase() as "best" | "great" | "brilliant"});
    expect(intent.claims.some(item => item.code === "best")).toBe(true);
    expect(renderDialogue(intent, walter).text).toContain("strong");
    expect(renderDialogue(intent, walter).text).not.toMatch(/best|only|engine|continuation/i);
  }
});

test("Walter keeps searched-alternative limits and the cold SRS gate", () => {
  for (const code of ["only_move", "decisive_resource", "sacrifice"]) {
    expect(render(claim(code)).text).toContain("checked");
    expect(render(claim(code)).text).not.toMatch(/difficult|hard to find/);
  }
  const cold = practiceIntent({position: {session_id: "cold", failed: false, theme: "POISON"} as never,
    feedback: null, frame: {annotation: "POISON fork wins queen"} as never, hadFailure: false, expression: "neutral"});
  const output = renderDialogue(cold, walter);
  expect(output.text).not.toMatch(/POISON|fork|queen|best/i);
  expect(output.renderedClaims?.map(item => item.code)).toEqual(["cold"]);
});
