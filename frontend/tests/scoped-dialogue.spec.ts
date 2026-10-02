import {test, expect} from "@playwright/test";
import {claim, makeIntent, type Claim, type TacticalPresentation} from "../src/dialogue/model";
import {tacticalPresentation, tacticalScopes, type TacticalPresentationKey} from "../src/dialogue/tacticalTemplates";
import {neutralTacticalTemplates} from "../src/dialogue/scopedTacticalWording";
import {renderDialogue} from "../src/dialogue/neutral";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {robot} from "../src/dialogue/characters/robot";
import {capybara} from "../src/dialogue/characters/groundedQuiet";
import {mushroom} from "../src/dialogue/characters/mushroom";
import {ghost} from "../src/dialogue/characters/ghost";
import {slime} from "../src/dialogue/characters/slime";
import {alien} from "../src/dialogue/characters/alien";
import {livingPawn, raccoon} from "../src/dialogue/characters/groundedPractical";
import {wizard} from "../src/dialogue/characters/wizard";
import {tuxedo} from "../src/dialogue/characters/tuxedo";
import {professor} from "../src/dialogue/characters/professor";
import {kitten} from "../src/dialogue/characters/groundedPets";
import {dragon} from "../src/dialogue/characters/dragon";
import {collie} from "../src/dialogue/characters/collie";
import {velvet} from "../src/dialogue/characters/velvet";
import {corgi} from "../src/dialogue/characters/corgi";
import {unicorn} from "../src/dialogue/characters/unicorn";
import {expert} from "../src/dialogue/characters/expert";
import {partner} from "../src/dialogue/characters/partner";
import {factualParts, validWording} from "../src/dialogue/composition";
import {practiceIntent} from "../src/dialogue/practiceIntent";

const coaches = [{id: "classic", personality: storyteller}, {id: "robot", personality: robot},
  {id: "capybara", personality: capybara}, {id: "mushroom", personality: mushroom}, {id: "ghost", personality: ghost},
  {id: "slime", personality: slime},
  {id: "alien", personality: alien},
  {id: "living-pawn", personality: livingPawn},
  {id: "wizard", personality: wizard},
  {id: "cat-tuxedo", personality: tuxedo},
  {id: "raccoon", personality: raccoon},
  {id: "dog-gentle", personality: professor},
  {id: "cat-kitten", personality: kitten},
  {id: "dragon", personality: dragon},
  {id: "dog-collie", personality: collie},
  {id: "cat-black", personality: velvet},
  {id: "dog-corgi", personality: corgi},
  {id: "unicorn", personality: unicorn},
  {id: "man-expert", personality: expert},
  {id: "man-partner", personality: partner}];
function item(role: "played" | "allowed" | "missed", timing: TacticalPresentation["timing"], effect: TacticalPresentation["effect"]): Claim {
  return {...claim(`tactic_${role}`, {move: "Nf3", best: "Ng5", opponent: "Black", motif: "pin", detail: "Original prose remains intact."},
    90, [{source: "stockfish", id: "search", field: "findings"}], ["event"]),
    tactic: {timing, actor: role === "allowed" ? "black" : "white", action: role === "allowed" ? "Bb4" : role === "missed" ? "Ng5" : "Nf3", effect}};
}

const cases: Claim[] = [];
for (const scope of tacticalScopes) {
  const [role, timing] = scope.split("_") as ["played" | "allowed" | "missed", TacticalPresentation["timing"]];
  for (const effect of [{kind: "none"}, {kind: "fork", targets: ["king on h7", "queen on e4"]}, {kind: "material"},
    {kind: "capture", san: "Nxe4", piece: "queen", ply: 3}] as TacticalPresentation["effect"][]) cases.push(item(role, timing, effect));
  if (role !== "played") cases.push(item(role, timing,
    {kind: "capture", san: role === "allowed" ? "Bb4" : "Ng5", piece: "queen", ply: role === "allowed" ? 2 : 1}));
}
cases.push(item("played", "possible", {kind: "capture", san: "Nf3", piece: "queen", ply: 1}));

test("all 29 scoped meanings have complete independently authored factual templates for every opted-in voice", () => {
  const keys = cases.map(value => tacticalPresentation(value)!.code);
  expect(new Set(keys).size).toBe(29);
  expect([...new Set(keys)].sort()).toEqual(Object.keys(neutralTacticalTemplates).sort());
  for (const code of keys) {
    const reference = neutralTacticalTemplates[code];
    for (const coach of coaches) {
      const options = coach.personality.templates[code]!;
      expect(options.length).toBeGreaterThan(0);
      for (const wording of options) expect(validWording(wording, reference), `${coach.id}/${code}`).toBe(true);
    }
    const authored = coaches.map(coach => factualParts(coach.personality.templates[code]![0]).join(" "));
    expect(new Set(authored).size).toBe(coaches.length);
    expect(authored.join(" ")).not.toMatch(/\{setup\}|\{detail\}/);
  }
});

for (const coach of coaches) test(`${coach.id}: scope, original evidence and required effects survive both learner and opponent rendering`, () => {
  for (const value of cases) for (const subject of ["learner", "opponent"] as const) {
    const projected = tacticalPresentation(value)!;
    expect(projected.slots).not.toHaveProperty("setup");
    expect(projected.slots).not.toHaveProperty("detail");
    expect(Object.values(projected.slots).every(slot => slot === undefined || !/[.!?]$/.test(slot))).toBe(true);
    const intent = makeIntent("scoped", "best", "game", "best", [value], [], subject);
    const snapshot = JSON.stringify(intent);
    const output = renderDialogue(intent, coach);
    expect(output.renderedClaims).toEqual([value]);
    expect(output.trace.variants[0]).toMatchObject({code: value.code, source: coach.personality.version, sourceIds: ["event"]});
    expect(output.text).not.toMatch(/\{|\}|undefined|Original prose|wins material|guaranteed|forced gain|new pin|creates a pin/);
    expect(output.text.length).toBeLessThanOrEqual(coach.personality.maxCharacters);
    expect(JSON.stringify(intent)).toBe(snapshot);
    if (value.tactic!.effect.kind === "material") expect(output.text).toMatch(/may be|Possible result/);
    if (projected.code.includes("possible") && value.tactic!.effect.kind === "fork")
      expect(output.text).toMatch(/would be attacked|Potential simultaneous/);
    if (value.code === "tactic_missed") expect(output.text.indexOf("Ng5")).toBeLessThan(output.text.indexOf("queen") < 0 ? Infinity : output.text.indexOf("queen"));
    if (subject === "opponent") expect(output.text).not.toMatch(/you|your|well done|well judged|nicely/i);
  }
});

test("required reply and targets cannot hide in an optional cue in any scoped key", () => {
  for (const value of cases) {
    const projected = tacticalPresentation(value)!;
    const code: TacticalPresentationKey = projected.code;
    const options = neutralTacticalTemplates[code];
    const unsafe = {id: "unsafe", personality: {...robot, templates: {[code]: [{fact: "Idea noted.", observation: options[0]}]}}};
    const output = renderDialogue(makeIntent("guard", "best", "game", "best", [value]), unsafe);
    expect(output.trace.variants[0].source).toBe("tactical-scoped-2");
    expect(output.text).not.toContain("Idea noted");
  }
});

test("a material outcome cannot be omitted or moved to an optional cue while retaining only its scope", () => {
  const value = item("allowed", "immediate", {kind: "material"});
  const code = tacticalPresentation(value)!.code;
  for (const observation of [undefined, "A {gain} is possible."]) {
    const unsafe = {id: "unsafe", personality: {...robot, templates: {[code]: [{
      fact: "{opponent} can reply with {action}: there is a {motif}.", observation,
    }]}}};
    const output = renderDialogue(makeIntent("material-guard", "best", "game", "best", [value], [], "opponent"), unsafe);
    expect(output.trace.variants[0].source).toBe("tactical-scoped-2");
    expect(output.text).toContain("A material gain is possible, but it depends on how both sides follow up.");
  }
});

test("a missing required noun or move never renders literal undefined or retains an incomplete claim", () => {
  for (const [role, absent] of [["played", "move"], ["allowed", "opponent"], ["missed", "best"], ["played", "motif"]] as const) {
    const value = item(role, "immediate", {kind: "none"});
    delete value.slots[absent];
    for (const coach of coaches) {
      const output = renderDialogue(makeIntent("missing-slot", "best", "game", "best", [value]), coach);
      expect(output.renderedClaims).toEqual([]);
      expect(output.text).not.toMatch(/undefined|\{|\}|can reply|there is/);
    }
  }
});

test("every opted-in voice keeps the cold practice gate and avoid claiming generic strong means literal Best", () => {
  const cold = practiceIntent({position: {session_id: "cold", failed: false, theme: "POISON"} as never,
    feedback: null, frame: {annotation: "POISON fork wins queen"} as never, hadFailure: false, expression: "neutral"});
  for (const coach of coaches) {
    expect(renderDialogue(cold, coach).text).not.toMatch(/POISON|fork|queen|best/i);
    const output = renderDialogue(makeIntent("strong", "great", "game", "great", [claim("best")]), coach);
    expect(output.text).toMatch(/strong/i);
    expect(output.text).not.toMatch(/best|only|near|close|guaranteed/i);
  }
});
