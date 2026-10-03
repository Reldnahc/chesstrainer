import {expect, test} from "@playwright/test";
import type {Game} from "../src/gameReview/types";
import {gameIntent} from "../src/dialogue/gameIntent";
import {renderDialogue} from "../src/dialogue/neutral";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {robot} from "../src/dialogue/characters/robot";
import {gameReaction} from "../src/coach/reactions";
import {selectGameRecording, selectGameSpeech, type GameSpeechContext} from "../src/audio/speech/gameSelection";
import {humanInsightIntent, humanInsightLabels} from "../src/dialogue/humanClaims";
import {semanticFixtures} from "../tests/semantic-fixtures";
import catalogue from "../src/audio/speech/meanings.json" with {type: "json"};

// Coaches never speak a Maia (human-move model) reading. The badge, its popup
// and the written bubble sentence stay; speech carries only objective facts.
const games = semanticFixtures<Record<string, Game>>("review_speech_combination_fixtures.py");
const coaches = [{id: "classic", personality: storyteller}, {id: "robot", personality: robot}];
// Positions whose bubble renders an objective fact followed by a Maia sentence.
const objectiveThenMaia: [string, string][] = [
  ["evaluation-natural", "evaluation-loss"],
  ["allowed-mate-natural", "allowed-mate"],
  ["missed-mate-natural", "missed-mate"],
  ["capture-natural", "immediate-capture"],
  ["allowed-fork-natural", "tactic-fork-allowed"],
  ["allowed-skewer-natural", "tactic-skewer-allowed"],
  ["fork-hard_find", "tactic-fork-played"],
  ["fork-unusual_strong", "tactic-fork-played"],
  ["pin-hard_find", "tactic-pin-played"],
  ["pin-unusual_strong", "tactic-pin-played"],
  ["resource-defense-hard_find", "only-playable-move"],
  ["resource-advantage-hard_find", "only-advantage-resource"],
  ["resource-defense-unusual_strong", "only-playable-move"],
  ["resource-advantage-unusual_strong", "only-advantage-resource"],
  ["unsupported-defensive-pair", "evaluation-loss"],
];

function context(name: string, coach = coaches[0], game = structuredClone(games[name])): GameSpeechContext {
  const frame = game.frames[1], report = frame.report!;
  const key = `combination-${name}`;
  const reaction = gameReaction({key, frame, report, learner: game.orientation,
    explaining: false, error: false, pending: false});
  const intent = gameIntent({game, frame, report, ply: 1, key, expression: reaction.state});
  return {game, frame, report, ply: 1, intent, utterance: renderDialogue(intent, coach)};
}

test("the speech catalogue has no Maia meanings or objective/Maia combinations", () => {
  const ids = catalogue.meanings.map(item => item.id);
  expect(ids.filter(id => /^(?:human-|combo-|combined-)/.test(id))).toEqual([]);
  expect(catalogue.meanings.filter(item => "primary" in item || "secondary" in item)).toEqual([]);
});

for (const coach of coaches) {
  for (const [name, objectiveId] of objectiveThenMaia) test(`${coach.id}: ${name} speaks only the objective line`, () => {
    const current = context(name, coach);
    const rendered = current.utterance.renderedClaims!;
    expect(rendered).toHaveLength(2);
    expect(humanInsightLabels[rendered[0].code]).toBeUndefined();
    // The Maia sentence is still written in the bubble; it adds nothing to speech.
    expect(humanInsightLabels[rendered[1].code]).toBeTruthy();
    expect(selectGameRecording({...current, claimIndex: 1})).toBeNull();
    expect(selectGameSpeech(current)).toEqual({primaryId: objectiveId, recordingId: objectiveId});
  });

  test(`${coach.id}: a Maia sentence shown first still leaves only the objective line`, () => {
    const current = context("evaluation-natural", coach);
    const utterance = structuredClone(current.utterance);
    utterance.renderedClaims!.reverse();
    utterance.trace.variants.reverse();
    expect(humanInsightLabels[utterance.renderedClaims![0].code]).toBeTruthy();
    expect(selectGameSpeech({...current, utterance})).toEqual({primaryId: "evaluation-loss", recordingId: "evaluation-loss"});
  });

  for (const name of Object.keys(games).filter(name => name.startsWith("cause-")))
    test(`${coach.id}: ${name} keeps its bubble speech while the Maia insight is shown`, () => {
      const current = context(name, coach);
      expect(current.intent.claims.some(item => humanInsightLabels[item.code])).toBe(true);
      expect(current.utterance.renderedClaims!.some(item => humanInsightLabels[item.code])).toBe(false);
      // The insight still renders its written reading beside the bubble.
      const intent = humanInsightIntent(current.intent);
      expect(renderDialogue(intent, coach).renderedClaims!.map(item => item.code)).toEqual(["human_natural_error"]);
      const selected = selectGameSpeech(current);
      // A position can support several causes. Use the one actually displayed.
      expect(selected.primaryId).toBe(current.utterance.renderedClaims![0].code.replaceAll("_", "-"));
      const second = selectGameRecording({...current, claimIndex: 1});
      expect(selected.recordingId).toBe(second ? `${selected.primaryId}+${second}` : selected.primaryId);
    });

  test(`${coach.id}: one move offers the same clip with or without a Maia reading`, () => {
    const name = "cause-abandoned_defender-white";
    const plain = structuredClone(games[name]), report = plain.frames[1].report!;
    report.human = null;
    report.practical = null;
    report.intelligence!.events = report.intelligence!.events.filter(event => event.kind !== "human_contrast");
    const withoutMaia = context(name, coach, plain);
    const withMaia = context(name, coach);
    for (const current of [withoutMaia, withMaia]) {
      expect(current.utterance.renderedClaims!.map(item => item.code)).toEqual(["cause_abandoned_defender", expect.any(String)]);
      // A recorded second sentence joins the first as one back-to-back playback.
      const second = selectGameRecording({...current, claimIndex: 1});
      expect(selectGameSpeech(current)).toEqual({primaryId: "cause-abandoned-defender",
        recordingId: second ? `cause-abandoned-defender+${second}` : "cause-abandoned-defender"});
    }
  });

  test(`${coach.id}: a bubble whose only claim is Maia stays silent`, () => {
    const current = context("human-without-objective", coach);
    expect(current.intent.claims.map(item => item.code)).toEqual(["human_rare"]);
    expect(current.utterance.renderedClaims!.map(item => item.code)).toEqual(["human_rare"]);
    expect(selectGameRecording(current)).toBeNull();
    expect(selectGameSpeech(current)).toEqual({primaryId: null, recordingId: null});
  });

  test(`${coach.id}: the separate Maia insight selects no recording`, () => {
    const current = context("evaluation-natural", coach);
    const intent = humanInsightIntent(current.intent);
    const utterance = renderDialogue(intent, coach);
    expect(utterance.renderedClaims!.map(item => item.code)).toEqual(["human_natural_error"]);
    expect(selectGameSpeech({...current, intent, utterance})).toEqual({primaryId: null, recordingId: null});
  });

  test(`${coach.id}: stale or mismatched policy keeps the objective recording`, () => {
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
      expect(selectGameSpeech(current)).toEqual({primaryId: "evaluation-loss",
        recordingId: "evaluation-loss"});
      const fresh = context("evaluation-natural", coach, current.game);
      expect(fresh.intent.claims.some(item => humanInsightLabels[item.code])).toBe(false);
      expect(selectGameSpeech(fresh).recordingId).toBe("evaluation-loss+recognized-opening");
    }
  });

  test(`${coach.id}: opponent review keeps the objective recording without learner human feedback`, () => {
    const game = structuredClone(games["evaluation-natural"]);
    game.orientation = "black";
    const current = context("evaluation-natural", coach, game);
    expect(current.intent.subject).toBe("opponent");
    expect(current.intent.claims.some(item => humanInsightLabels[item.code])).toBe(false);
    expect(selectGameSpeech(current).recordingId).toBe("evaluation-loss+recognized-opening");
  });

  test(`${coach.id}: unresolved or stale positions select nothing`, () => {
    const current = context("evaluation-natural", coach);
    for (const blocked of [{...current, pending: true}, {...current, error: true},
      {...current, frame: {...current.frame!, fen: games["fork-hard_find"].frames[1].fen}},
      {...current, utterance: {...current.utterance, intentId: "previous-position"}}]) {
      expect(selectGameSpeech(blocked)).toEqual({primaryId: null, recordingId: null});
    }
  });
}
