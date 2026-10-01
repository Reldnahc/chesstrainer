import {expect, test} from "@playwright/test";
import type {Game} from "../src/gameReview/types";
import {gameIntent} from "../src/dialogue/gameIntent";
import {renderDialogue} from "../src/dialogue/neutral";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {robot} from "../src/dialogue/characters/robot";
import {gameReaction} from "../src/coach/reactions";
import {selectGameSpeech, type GameSpeechContext} from "../src/audio/speech/gameSelection";
import {humanInsightIntent, humanInsightLabels} from "../src/dialogue/humanClaims";
import {semanticFixtures} from "../tests/semantic-fixtures";
import catalogue from "../src/audio/speech/meanings.json" with {type: "json"};

const games = semanticFixtures<Record<string, Game>>("review_speech_combination_fixtures.py");
const coaches = [{id: "classic", personality: storyteller}, {id: "robot", personality: robot}];
const combinations: [string, string, string][] = [
  ["evaluation-natural", "evaluation-loss", "human-natural-error"],
  ["allowed-mate-natural", "allowed-mate", "human-natural-error"],
  ["missed-mate-natural", "missed-mate", "human-natural-error"],
  ["capture-natural", "immediate-capture", "human-natural-error"],
  ["allowed-fork-natural", "tactic-fork-allowed", "human-natural-error"],
  ["allowed-skewer-natural", "tactic-skewer-allowed", "human-natural-error"],
  ["fork-hard_find", "tactic-fork-played", "human-hard-find"],
  ["fork-unusual_strong", "tactic-fork-played", "human-unusual-strong"],
  ["pin-hard_find", "tactic-pin-played", "human-hard-find"],
  ["pin-unusual_strong", "tactic-pin-played", "human-unusual-strong"],
  ["resource-defense-hard_find", "only-playable-move", "human-hard-find"],
  ["resource-advantage-hard_find", "only-advantage-resource", "human-hard-find"],
  ["resource-defense-unusual_strong", "only-playable-move", "human-hard-defense-found"],
  ["resource-advantage-unusual_strong", "only-advantage-resource", "human-hard-defense-found"],
];

function context(name: string, coach = coaches[0], game = structuredClone(games[name])): GameSpeechContext {
  const frame = game.frames[1], report = frame.report!;
  const key = `combination-${name}`;
  const reaction = gameReaction({key, frame, report, learner: game.orientation,
    explaining: false, error: false, pending: false});
  const intent = gameIntent({game, frame, report, ply: 1, key, expression: reaction.state});
  return {game, frame, report, ply: 1, intent, utterance: renderDialogue(intent, coach)};
}

test("the original recorded combinations retain their reachable production fixtures", () => {
  const recorded = catalogue.meanings.filter(item => "primary" in item && "secondary" in item)
    .map(item => `${item.primary}:${item.secondary}`).sort();
  expect(recorded).toEqual(expect.arrayContaining(combinations.map(([, primary, secondary]) => `${primary}:${secondary}`)));
  expect(new Set(recorded).size).toBe(recorded.length);
});

for (const coach of coaches) {
  for (const [name, primaryId, secondaryId] of combinations) test(`${coach.id}: ${name} selects a single whole recording for both visible claims`, () => {
    const current = context(name, coach);
    const rendered = current.utterance.renderedClaims!;
    expect(rendered).toHaveLength(2);
    expect(humanInsightLabels[rendered[0].code]).toBeUndefined();
    expect(humanInsightLabels[rendered[1].code]).toBeTruthy();
    expect(rendered[1].evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({source: "human", id: current.report!.human!.evidence_id}),
      expect.objectContaining({source: "stockfish"}),
    ]));
    expect(selectGameSpeech(current)).toEqual({primaryId, secondaryId,
      recordingId: `combined-${primaryId}-with-${secondaryId}`});
  });

  for (const name of Object.keys(games).filter(name => name.startsWith("cause-")))
    test(`${coach.id}: ${name} requires an explicitly prepared visible insight when human prose is absent`, () => {
      const current = context(name, coach);
      expect(current.intent.claims.some(item => humanInsightLabels[item.code])).toBe(true);
      expect(current.utterance.renderedClaims!.some(item => humanInsightLabels[item.code])).toBe(false);
      const selected = selectGameSpeech(current);
      expect(selected.primaryId).toMatch(/^cause-/);
      expect(selected.recordingId).toBe(selected.primaryId);
      expect(selected.secondaryId?.startsWith("human-") ?? false).toBe(false);
      const intent = humanInsightIntent(current.intent);
      const utterance = renderDialogue(intent, coach);
      const combined = catalogue.meanings.find(item => "primary" in item && item.primary === selected.primaryId
        && item.secondary === "human-natural-error");
      expect(combined).toBeDefined();
      expect(selectGameSpeech(current, {intent, utterance}).recordingId).toBe(combined!.id);
    });

  test(`${coach.id}: a visible hard-defense assessment selects its authored whole recording`, () => {
    const current = context("unsupported-defensive-pair", coach);
    expect(current.utterance.renderedClaims!.map(item => item.code)).toEqual(["loss", "difficult_defense"]);
    const combined = catalogue.meanings.find(item => "primary" in item && item.primary === "evaluation-loss"
      && item.secondary === "human-hard-defense-missed");
    expect(combined).toBeDefined();
    expect(selectGameSpeech(current)).toEqual({primaryId: "evaluation-loss",
      secondaryId: "human-hard-defense-missed", recordingId: combined!.id});
  });

  test(`${coach.id}: a human-only explanation does not invent the absent Best fallback`, () => {
    const current = context("human-without-objective", coach);
    expect(current.intent.claims.map(item => item.code)).toEqual(["human_rare"]);
    expect(selectGameSpeech(current)).toEqual({primaryId: "human-unusual-strong",
      secondaryId: null, recordingId: "human-unusual-strong"});
  });

  test(`${coach.id}: stale or mismatched policy cannot join a still-valid objective claim`, () => {
    const mutations: ((current: GameSpeechContext) => void)[] = [
      current => {current.report!.practical!.human_evidence_id = "older-policy";},
      current => {current.report!.human!.played!.uci = "a2a3";},
      current => {current.report!.human!.engine_best!.uci = "a2a3";},
      current => {current.report!.human!.mover = "black";},
      current => {current.report!.human!.status = "unavailable";},
    ];
    for (const mutate of mutations) {
      const current = context("evaluation-natural", coach);
      mutate(current);
      // Keep the previously visible utterance to simulate a stale UI snapshot.
      expect(selectGameSpeech(current)).toEqual({primaryId: "evaluation-loss", secondaryId: null,
        recordingId: "evaluation-loss"});
      const fresh = context("evaluation-natural", coach, current.game);
      expect(fresh.intent.claims.some(item => humanInsightLabels[item.code])).toBe(false);
      expect(selectGameSpeech(fresh).recordingId).toBe("evaluation-loss");
    }
  });

  test(`${coach.id}: opponent review keeps the objective recording without learner human feedback`, () => {
    const game = structuredClone(games["evaluation-natural"]);
    game.orientation = "black";
    const current = context("evaluation-natural", coach, game);
    expect(current.intent.subject).toBe("opponent");
    expect(current.intent.claims.some(item => humanInsightLabels[item.code])).toBe(false);
    expect(selectGameSpeech(current).recordingId).toBe("evaluation-loss");
  });

  test(`${coach.id}: the separate human insight speaks only its selected human claim`, () => {
    const current = context("evaluation-natural", coach);
    const intent = humanInsightIntent(current.intent);
    const utterance = renderDialogue(intent, coach);
    expect(selectGameSpeech({...current, intent, utterance, surface: "human-insight"})).toEqual({
      primaryId: "human-natural-error", secondaryId: null, recordingId: "human-natural-error",
    });
  });

  test(`${coach.id}: unresolved or stale positions never select a combined recording`, () => {
    const current = context("evaluation-natural", coach);
    for (const blocked of [{...current, pending: true}, {...current, error: true},
      {...current, frame: {...current.frame!, fen: games["fork-hard_find"].frames[1].fen}},
      {...current, utterance: {...current.utterance, intentId: "previous-position"}}]) {
      expect(selectGameSpeech(blocked)).toEqual({primaryId: null, secondaryId: null, recordingId: null});
    }
  });
}
