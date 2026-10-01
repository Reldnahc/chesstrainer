import {expect, test} from "@playwright/test";
import {execFileSync} from "node:child_process";
import path from "node:path";
import type {Game} from "../src/gameReview/types";
import {gameIntent} from "../src/dialogue/gameIntent";
import {humanInsightIntent, humanInsightLabels} from "../src/dialogue/humanClaims";
import {renderDialogue} from "../src/dialogue/neutral";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {robot} from "../src/dialogue/characters/robot";
import {gameReaction} from "../src/coach/reactions";
import {selectGameRecording, selectGameSpeech, type GameSpeechContext} from "../src/audio/speech/gameSelection";
import catalogue from "../src/audio/speech/meanings.json" with {type: "json"};

const root = path.resolve("..");
const python = process.env.TEST_PYTHON || path.join(root, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
function loadGames(filename: string): Record<string, Game> {
  return JSON.parse(execFileSync(python, [path.join(root, "backend/tests", filename)],
    {encoding: "utf8", cwd: root, maxBuffer: 8 * 1024 * 1024}));
}
const games = {...loadGames("review_speech_policy_fixtures.py"), ...loadGames("review_speech_relationship_fixtures.py")};
const coaches = [{id: "classic", personality: storyteller}, {id: "robot", personality: robot}];
const pairs = new Map(catalogue.meanings.flatMap(item => "primary" in item && "secondary" in item
  ? [[`${item.primary}:${item.secondary}`, item.id] as const] : []));
const strong = ["human-hard-find", "human-unusual-strong", "human-natural-best", "human-natural-strong"];
const poor = ["human-natural-error", "human-hard-defense-missed"];
const resources = ["human-hard-find", "human-hard-defense-found", "human-natural-best"];
const observedFamilies: Record<string, string[]> = {
  "evaluation-loss": poor, "allowed-mate": poor, "missed-mate": poor,
  "immediate-capture": poor, "recognized-opening": [...strong, "human-hard-defense-found"],
  "cause-abandoned-defender": poor, "cause-opponent-threat-recognition": poor, "cause-avoiding-bad-trades": poor,
  "tactic-fork-played": strong, "tactic-pin-played": strong,
  "tactic-fork-allowed": poor, "tactic-skewer-allowed": poor, "tactic-fork-missed": poor,
  "sound-sacrifice": strong,
  "only-playable-move": resources, "only-advantage-resource": resources,
  "positional-rook-open-actual": strong, "positional-rook-semi-open-actual": strong,
  "clock-low": strong, "clock-fast": strong, "clock-long": strong,
  "positional-bishop-pair-actual": strong, "positional-passer-advance-actual": strong, "positional-king-flight-actual": strong,
  "recovery": strong, "recovery-assisted": strong, "chance-taken": strong, "chance-missed": poor,
  "support-restored": strong, "advantage-converted": strong,
};

function presentation(name: string, coach = coaches[0], game = structuredClone(games[name])) {
  const ply = game.frames.length - 1, frame = game.frames[ply], report = frame.report!;
  const reaction = gameReaction({key: name, frame, report, learner: game.orientation,
    explaining: false, error: false, pending: false});
  const intent = gameIntent({key: name, game, frame, report, ply, expression: reaction.state});
  const context: GameSpeechContext = {game, frame, report, ply, intent, utterance: renderDialogue(intent, coach)};
  const child = humanInsightIntent(intent);
  const insight = {intent: child, utterance: renderDialogue(child, coach)};
  return {context, insight};
}

for (const coach of coaches) {
  test(`${coach.id}: coherent policy profiles select all seven insights and complete family combinations`, () => {
    const observed = new Map<string, Set<string>>(), humanStates = new Set<string>();
    let humanFirst = 0, badgeOnly = 0;
    for (const name of Object.keys(games)) {
      const {context, insight} = presentation(name, coach);
      const humanId = selectGameRecording({...context, ...insight, surface: "human-insight"});
      if (humanId) humanStates.add(humanId);
      const index = context.utterance.renderedClaims!.findIndex(item => !humanInsightLabels[item.code]);
      const objectiveId = index < 0 ? null : selectGameRecording({...context, claimIndex: index});
      if (!objectiveId || !humanId) continue;
      const expected = pairs.get(`${objectiveId}:${humanId}`);
      expect(expected, `${name}: ${objectiveId}/${humanId} needs its complete authored recording`).toBeDefined();
      expect(selectGameSpeech(context, insight).recordingId, name).toBe(expected);
      observed.set(objectiveId, new Set([...(observed.get(objectiveId) ?? []), humanId]));
      if (index > 0) humanFirst++;
      if (!context.utterance.renderedClaims!.some(item => humanInsightLabels[item.code])) badgeOnly++;
    }
    for (const [objective, humans] of Object.entries(observedFamilies))
      expect([...(observed.get(objective) ?? [])].sort(), objective).toEqual([...humans].sort());
    expect([...humanStates].sort()).toEqual([...poor, ...strong, "human-hard-defense-found"].sort());
    expect(humanFirst).toBeGreaterThan(0);
    expect(badgeOnly).toBeGreaterThan(0);
  });

  test(`${coach.id}: the selected defense insight supersedes the coexisting natural-error claim`, () => {
    const {context, insight} = presentation("cause-abandoned_defender-white-narrow-preferred-unusual", coach);
    expect(context.intent.claims.map(item => item.code)).toEqual(expect.arrayContaining(["human_natural_error", "difficult_defense"]));
    expect(insight.intent.claims.map(item => item.code)).toEqual(["difficult_defense"]);
    expect(selectGameSpeech(context, insight).recordingId).toBe(pairs.get("cause-abandoned-defender:human-hard-defense-missed"));
  });

  test(`${coach.id}: a back-rank mating witness keeps the higher mate explanation`, () => {
    for (const role of ["allowed", "missed"]) for (const [profile, human] of [
      ["preferred", "human-natural-error"], ["preferred-unusual", "human-hard-defense-missed"],
    ]) {
      const {context, insight} = presentation(`back-rank-${role}-narrow-${profile}`, coach);
      expect(context.report!.intelligence!.events).toEqual(expect.arrayContaining([
        expect.objectContaining({kind: "tactic", facts: expect.objectContaining({motif: "back_rank", role})}),
      ]));
      expect(selectGameRecording(context)).toBe(`${role}-mate`);
      expect(selectGameSpeech(context, insight).recordingId).toBe(pairs.get(`${role}-mate:${human}`));
      expect(pairs.has(`tactic-back-rank-${role}:${human}`)).toBe(false);
    }
  });

  test(`${coach.id}: stale, wrong-coach, or altered insight cannot authorize a composite`, () => {
    const {context, insight} = presentation("cause-abandoned_defender-white-preferred", coach);
    const fallback = selectGameRecording(context);
    const stale = presentation("cause-avoiding_bad_trades-white-preferred", coach).insight;
    const wrongCoach = {...insight, utterance: {...insight.utterance, coachId: coach.id === "classic" ? "robot" : "classic"}};
    const altered = structuredClone(insight);
    altered.utterance.renderedClaims![0].evidence[0].id = "other-policy";
    for (const invalid of [stale, wrongCoach, altered])
      expect(selectGameSpeech(context, invalid).recordingId).toBe(fallback);
    expect(selectGameSpeech(context).recordingId).toBe(fallback);
  });

  test(`${coach.id}: late unavailable policy removes the chip without changing the objective fallback`, () => {
    const {context, insight} = presentation("cause-abandoned_defender-white-preferred", coach);
    const fallback = selectGameRecording(context);
    context.report!.human!.status = "unavailable";
    expect(selectGameSpeech(context, insight).recordingId).toBe(fallback);
    const current = presentation("cause-abandoned_defender-white-preferred", coach, context.game);
    expect(current.insight.intent.claims).toEqual([]);
    expect(selectGameSpeech(current.context, current.insight).recordingId).toBe(fallback);
  });

  test(`${coach.id}: opponent and variation contexts cannot borrow another visible Maia insight`, () => {
    const original = presentation("cause-abandoned_defender-white-preferred", coach);
    const game = structuredClone(original.context.game);
    game.orientation = "black";
    const opponent = presentation("cause-abandoned_defender-white-preferred", coach, game);
    expect(opponent.insight.intent.claims).toEqual([]);
    expect(selectGameSpeech(opponent.context, original.insight).recordingId).toBe(selectGameRecording(opponent.context));
    const parent = original.context;
    const intent = gameIntent({...parent, key: "branch", variation: true, expression: parent.intent.expression});
    const branch = {...parent, variation: true, intent, utterance: renderDialogue(intent, coach)};
    expect(selectGameSpeech(branch, original.insight).recordingId).toBe(selectGameRecording(branch));
  });
}

test("every combined meaning is a unique bounded identifier of an objective plus one supported human insight", () => {
  const ids = new Set<string>(), tuples = new Set<string>();
  for (const item of catalogue.meanings) {
    if (!("primary" in item) || !("secondary" in item) || !item.primary || !item.secondary) continue;
    expect(item.id.length).toBeLessThanOrEqual(64);
    expect(ids.has(item.id)).toBe(false);
    expect(tuples.has(`${item.primary}:${item.secondary}`)).toBe(false);
    expect(item.primary.startsWith("human-")).toBe(false);
    expect([...poor, ...strong, "human-hard-defense-found"]).toContain(item.secondary);
    ids.add(item.id); tuples.add(`${item.primary}:${item.secondary}`);
  }
});
