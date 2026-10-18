import { expect, test } from "../tests/helpers/browserTest";
import type { Game } from "../src/gameReview/types";
import { gameIntent } from "../src/dialogue/gameIntent";
import { renderDialogue } from "../src/dialogue/neutral";
import { classic } from "../src/dialogue/characters/classic";
import { robot } from "../src/dialogue/characters/robot";
import { gameReaction } from "../src/coach/reactions";
import {
  gradeTakeIds,
  selectGameRecording,
  selectGameSpeech,
  type GameSpeechContext,
} from "../src/audio/speech/gameSelection";
import { semanticFixtures } from "../tests/semantic-fixtures";
import { humanGames } from "../tests/human-fixtures";

// The fewest takes any grade has; imported extra takes (grade-best-5, ...) join their grade.
const GRADE_TAKES = 4;

// A ply whose whole line is the generic reading for its grade rotates through
// that grade's takes; anything specific keeps its own clip.
const games = semanticFixtures<Record<string, Game>>("review_speech_combination_fixtures.py");
const coaches = [
  { id: "classic", personality: classic },
  { id: "robot", personality: robot },
];

function context(game: Game, ply = 1, coach = coaches[0]): GameSpeechContext {
  const frame = game.frames[ply],
    report = frame.report!;
  const key = `grade-${ply}`;
  const reaction = gameReaction({
    key,
    frame,
    report,
    learner: game.orientation,
    explaining: false,
    error: false,
    pending: false,
  });
  const intent = gameIntent({ game, frame, report, ply, key, expression: reaction.state });
  return { game, frame, report, ply, intent, utterance: renderDialogue(intent, coach) };
}

/** The evaluation-loss fixture without its book line, graded as given. */
function plainError(label: string) {
  const game = structuredClone(games["evaluation-natural"]);
  game.frames[1].report!.opening = null;
  game.frames[1].report!.label = label as never;
  return game;
}

// The pool lookup is grade-generic and coach-independent: one coach, two grades.
for (const [label, pool] of [
  ["Inaccuracy", "inaccuracy"],
  ["Blunder", "blunder"],
])
  test(`classic: a plain ${label} offers a ${pool} take over the generic reading`, () => {
    const speech = selectGameSpeech(context(plainError(label), 1, coaches[0]));
    expect(speech.recordingId).toMatch(/^(?:evaluation-loss|stronger-alternative)/);
    expect(gradeTakeIds(label)).toContain(speech.gradeId);
  });

for (const [label, generic] of [
  ["Best", "best-supported-choice"],
  ["Good", "good-choice"],
])
  test(`classic: a plain ${label} move offers a take from its own grade`, () => {
    // This policy fixture opens 1.e4; without the book line it has nothing specific to say.
    const game = structuredClone(humanGames.natural_best);
    game.frames[1].report!.opening = null;
    game.frames[1].report!.label = label as never;
    const speech = selectGameSpeech(context(game, 1, coaches[0]));
    expect(speech.recordingId).toBe(generic);
    expect(gradeTakeIds(label)).toContain(speech.gradeId);
  });

for (const coach of coaches) {
  test(`${coach.id}: the evaluation-loss reading, which can call the cost small, is kept for Inaccuracies`, () => {
    const loss = (label: string) => {
      const game = plainError(label),
        item = context(game, 1, coach);
      const index = item.utterance.renderedClaims!.findIndex(claim => claim.code === "loss");
      expect(index).toBeGreaterThanOrEqual(0);
      return selectGameRecording({ ...item, claimIndex: index });
    };
    expect(loss("Inaccuracy")).toBe("evaluation-loss");
    for (const label of ["Mistake", "Miss", "Blunder"]) {
      expect(loss(label)).toBeNull();
      expect(selectGameSpeech(context(plainError(label), 1, coach)).recordingId).not.toMatch(
        /evaluation-loss/,
      );
    }
  });

  test(`${coach.id}: specific content keeps its own clip`, () => {
    for (const name of ["capture-natural", "allowed-fork-natural", "allowed-mate-natural"]) {
      const game = structuredClone(games[name]);
      game.frames[1].report!.opening = null;
      expect(selectGameSpeech(context(game, 1, coach)).gradeId).toBeUndefined();
    }
    // An opening sentence beside the evaluation is specific too.
    expect(
      selectGameSpeech(context(structuredClone(games["evaluation-natural"]), 1, coach)).gradeId,
    ).toBeUndefined();
  });
}

/** The same plain inaccuracy repeated at plies 1..length of one game. */
function repeatedError(length: number) {
  const base = plainError("Inaccuracy");
  return {
    ...base,
    frames: [base.frames[0], ...Array.from({ length }, () => structuredClone(base.frames[1]))],
  };
}

test("neighbouring same-grade moves play every take before any repeats", () => {
  const rounds = 6,
    game = repeatedError(rounds * GRADE_TAKES);
  const takes = Array.from(
    { length: rounds * GRADE_TAKES },
    (_, index) => selectGameSpeech(context(game, index + 1)).gradeId,
  );
  expect(takes.every(Boolean)).toBe(true);
  // No take plays twice in a row, including across the end of a round.
  for (let index = 1; index < takes.length; index++)
    expect(takes[index]).not.toBe(takes[index - 1]);
  // A side's back-to-back moves are two same-grade moves apart; they never share a take either.
  for (let index = 2; index < takes.length; index++)
    expect(takes[index]).not.toBe(takes[index - 2]);
  for (let round = 0; round < rounds; round++)
    expect(new Set(takes.slice(round * GRADE_TAKES, (round + 1) * GRADE_TAKES)).size).toBe(
      GRADE_TAKES,
    );
  // Later rounds are reshuffled rather than replaying the first round's order.
  expect(
    new Set(
      Array.from({ length: rounds }, (_, round) =>
        takes.slice(round * GRADE_TAKES, (round + 1) * GRADE_TAKES).join(),
      ),
    ).size,
  ).toBeGreaterThan(1);
  // Replaying a ply repeats its take.
  expect(selectGameSpeech(context(game, 3)).gradeId).toBe(takes[2]);
  expect(selectGameSpeech(context(game, 11)).gradeId).toBe(takes[10]);
});
