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
import {humanGames} from "../tests/human-fixtures";
import catalogue from "../src/audio/speech/meanings.json" with {type: "json"};

// A coach never says or shows a Maia (human-move model) reading. Maia lives only
// in the badge and its popup; the coach's line carries the objective facts, and
// a sound move with nothing else to say gets the plain best or good line.
const games = semanticFixtures<Record<string, Game>>("review_speech_combination_fixtures.py");
const coaches = [{id: "classic", personality: storyteller}, {id: "robot", personality: robot}];
// Positions with an objective fact and a Maia reading.
const objectiveAndMaia: [string, string][] = [
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

/** The badge and popup's own intent, built exactly as PositionCoach builds it. */
function insight(current: GameSpeechContext) {
  const {game, frame, report} = current;
  const reaction = gameReaction({key: "insight", frame, report, learner: game.orientation,
    explaining: false, error: false, pending: false});
  return humanInsightIntent(gameIntent({game, frame, report, ply: 1, key: "insight",
    expression: reaction.state, human: true}));
}

const maia = (codes: {code: string}[]) => codes.filter(item => humanInsightLabels[item.code]);
const silent = {primaryId: null, recordingId: null, variants: {primaryId: null, recordingId: null}};

test("the speech catalogue has no Maia meanings or combinations", () => {
  expect(catalogue.meanings.map(item => item.id).filter(id => /^(?:human-|combo-|combined-)/.test(id))).toEqual([]);
  expect(catalogue.meanings.filter(item => "primary" in item || "secondary" in item)).toEqual([]);
});

for (const coach of coaches) {
  for (const [name, objectiveId] of objectiveAndMaia) test(`${coach.id}: ${name} says only the objective line`, () => {
    const current = context(name, coach);
    expect(maia(current.intent.claims)).toEqual([]);
    expect(maia(current.utterance.renderedClaims!)).toEqual([]);
    expect(selectGameSpeech(current).primaryId).toBe(objectiveId);
    // The reading is still there for the badge and its popup.
    expect(maia(insight(current).claims)).toHaveLength(1);
  });

  for (const [kind, code] of [["hard_find", "human_challenging"], ["unusual_strong", "human_rare"],
    ["natural_best", "human_natural_best"], ["natural_strong", "human_natural_strong"]] as const)
    test(`${coach.id}: a move whose only reading is ${kind} gets the plain line`, () => {
      // These policy fixtures open 1.e4/1.d4; without the book line Maia is all they have.
      const game = structuredClone(humanGames[kind]);
      game.frames[1].report!.opening = null;
      const current = context(`human-${kind}`, coach, game);
      const codes = current.utterance.renderedClaims!.map(item => item.code);
      expect(codes).toHaveLength(1);
      expect(["best", "good"]).toContain(codes[0]);
      expect(selectGameSpeech(current).primaryId).toBe(codes[0] === "best" ? "best-supported-choice" : "good-choice");
      expect(insight(current).claims.map(item => item.code)).toEqual([code]);
    });

  test(`${coach.id}: the Maia popup selects no recording`, () => {
    const current = context("evaluation-natural", coach);
    const intent = insight(current);
    const utterance = renderDialogue(intent, coach);
    expect(utterance.renderedClaims!.map(item => item.code)).toEqual(["human_natural_error"]);
    expect(selectGameSpeech({...current, intent, utterance})).toEqual(silent);
  });

  test(`${coach.id}: opponent review has no Maia reading anywhere`, () => {
    const game = structuredClone(games["evaluation-natural"]);
    game.orientation = "black";
    const current = context("evaluation-natural", coach, game);
    expect(current.intent.subject).toBe("opponent");
    expect(maia(insight(current).claims)).toEqual([]);
    expect(selectGameSpeech(current).recordingId).toBe("evaluation-loss+recognized-opening");
  });

  test(`${coach.id}: unresolved or stale positions select nothing`, () => {
    const current = context("evaluation-natural", coach);
    for (const blocked of [{...current, pending: true}, {...current, error: true},
      {...current, frame: {...current.frame!, fen: games["fork-hard_find"].frames[1].fen}},
      {...current, utterance: {...current.utterance, intentId: "previous-position"}}]) {
      expect(selectGameSpeech(blocked)).toEqual(silent);
    }
  });
}
