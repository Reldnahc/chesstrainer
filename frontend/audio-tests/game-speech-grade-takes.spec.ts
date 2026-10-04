import {expect, test} from "@playwright/test";
import type {Game} from "../src/gameReview/types";
import {gameIntent} from "../src/dialogue/gameIntent";
import {renderDialogue} from "../src/dialogue/neutral";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {robot} from "../src/dialogue/characters/robot";
import {gameReaction} from "../src/coach/reactions";
import {GRADE_TAKES, gradeTakeIds, selectGameSpeech, type GameSpeechContext} from "../src/audio/speech/gameSelection";
import {semanticFixtures} from "../tests/semantic-fixtures";
import {humanGames} from "../tests/human-fixtures";

// A ply whose whole line is the generic reading for its grade rotates through
// that grade's takes; anything specific keeps its own clip.
const games = semanticFixtures<Record<string, Game>>("review_speech_combination_fixtures.py");
const coaches = [{id: "classic", personality: storyteller}, {id: "robot", personality: robot}];

function context(game: Game, ply = 1, coach = coaches[0]): GameSpeechContext {
  const frame = game.frames[ply], report = frame.report!;
  const key = `grade-${ply}`;
  const reaction = gameReaction({key, frame, report, learner: game.orientation,
    explaining: false, error: false, pending: false});
  const intent = gameIntent({game, frame, report, ply, key, expression: reaction.state});
  return {game, frame, report, ply, intent, utterance: renderDialogue(intent, coach)};
}

/** The evaluation-loss fixture without its book line, graded as given. */
function plainError(label: string) {
  const game = structuredClone(games["evaluation-natural"]);
  game.frames[1].report!.opening = null;
  game.frames[1].report!.label = label as never;
  return game;
}

test("each grade has its own pool of takes", () => {
  const pools = ["Brilliant", "Great", "Best", "Good", "Inaccuracy", "Mistake", "Miss", "Blunder"].map(gradeTakeIds);
  expect(pools.every(ids => ids.length === GRADE_TAKES)).toBe(true);
  expect(new Set(pools.flat()).size).toBe(8 * GRADE_TAKES);
  expect(gradeTakeIds("Book")).toEqual([]);
});

for (const coach of coaches) {
  for (const [label, pool] of [["Inaccuracy", "inaccuracy"], ["Mistake", "mistake"], ["Miss", "miss"], ["Blunder", "blunder"]])
    test(`${coach.id}: a plain ${label} offers a ${pool} take over the generic reading`, () => {
      const speech = selectGameSpeech(context(plainError(label), 1, coach));
      expect(speech.recordingId).toMatch(/^(?:evaluation-loss|stronger-alternative)/);
      expect(gradeTakeIds(label)).toContain(speech.gradeId);
    });

  for (const [label, generic] of [["Brilliant", "best-supported-choice"], ["Great", "best-supported-choice"],
    ["Best", "best-supported-choice"], ["Good", "good-choice"]])
    test(`${coach.id}: a plain ${label} move offers a take from its own grade`, () => {
      // This policy fixture opens 1.e4; without the book line it has nothing specific to say.
      const game = structuredClone(humanGames.natural_best);
      game.frames[1].report!.opening = null;
      game.frames[1].report!.label = label as never;
      const speech = selectGameSpeech(context(game, 1, coach));
      expect(speech.recordingId).toBe(generic);
      expect(gradeTakeIds(label)).toContain(speech.gradeId);
    });

  test(`${coach.id}: specific content keeps its own clip`, () => {
    for (const name of ["capture-natural", "allowed-fork-natural", "allowed-mate-natural"]) {
      const game = structuredClone(games[name]);
      game.frames[1].report!.opening = null;
      expect(selectGameSpeech(context(game, 1, coach)).gradeId).toBeUndefined();
    }
    // An opening sentence beside the evaluation is specific too.
    expect(selectGameSpeech(context(structuredClone(games["evaluation-natural"]), 1, coach)).gradeId).toBeUndefined();
  });
}

test("neighbouring same-grade moves cycle through every take before repeating", () => {
  const base = plainError("Inaccuracy");
  // The same plain inaccuracy repeated at plies 1..8 of one game.
  const game = {...base, frames: [base.frames[0], ...Array.from({length: 8}, () => structuredClone(base.frames[1]))]};
  const takes = Array.from({length: 8}, (_, index) => selectGameSpeech(context(game, index + 1)).gradeId);
  expect(takes.every(Boolean)).toBe(true);
  for (let index = 1; index < takes.length; index++) expect(takes[index]).not.toBe(takes[index - 1]);
  expect(new Set(takes.slice(0, GRADE_TAKES)).size).toBe(GRADE_TAKES);
  expect(takes.slice(GRADE_TAKES)).toEqual(takes.slice(0, GRADE_TAKES));
  // Replaying a ply repeats its take.
  expect(selectGameSpeech(context(game, 3)).gradeId).toBe(takes[2]);
});
