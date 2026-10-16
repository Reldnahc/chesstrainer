import { expect, test } from "@playwright/test";
import type { Game } from "../src/gameReview/types";
import { gameIntent } from "../src/dialogue/gameIntent";
import { renderDialogue } from "../src/dialogue/neutral";
import { classic } from "../src/dialogue/characters/classic";
import { gameReaction } from "../src/coach/reactions";
import { selectGameRecording, type GameSpeechContext } from "../src/audio/speech/gameSelection";
import { semanticFixtures } from "../tests/semantic-fixtures";

// Positional takes count one step, one new flight square, and a file that stays
// semi-open; a fact that says otherwise must not select them (chess audit, Low).
const games = {
  ...semanticFixtures<Record<string, Game>>("review_speech_policy_fixtures.py"),
  ...semanticFixtures<Record<string, Game>>("review_speech_relationship_fixtures.py"),
};
const coach = { id: "classic", personality: classic };

function recordings(game: Game) {
  const ply = game.frames.length - 1,
    frame = game.frames[ply],
    report = frame.report!;
  const reaction = gameReaction({
    key: game.id,
    frame,
    report,
    learner: game.orientation,
    explaining: false,
    error: false,
    pending: false,
  });
  const intent = gameIntent({ key: game.id, game, frame, report, ply, expression: reaction.state });
  const context: GameSpeechContext = {
    game,
    frame,
    report,
    ply,
    intent,
    utterance: renderDialogue(intent, coach),
  };
  return context.utterance.renderedClaims!.map((_, claimIndex) =>
    selectGameRecording({ ...context, claimIndex }),
  );
}

function withFeature(
  feature: string,
  recording: string,
  change: (facts: Record<string, unknown>) => void,
): [Game, Game] | null {
  for (const game of Object.values(games)) {
    const report = game.frames[game.frames.length - 1].report!;
    if (
      !report.intelligence?.events.some(
        event => event.kind === "positional" && event.facts.feature === feature,
      )
    )
      continue;
    if (!recordings(game).includes(recording)) continue;
    const changed = structuredClone(game);
    for (const event of changed.frames[changed.frames.length - 1].report!.intelligence!.events)
      if (event.kind === "positional" && event.facts.feature === feature)
        change(event.facts as Record<string, unknown>);
    return [game, changed];
  }
  return null;
}

const cases: [string, string, (facts: Record<string, unknown>) => void][] = [
  [
    "passed_pawn_advance",
    "positional-passer-advance-actual",
    facts => {
      const to = String(facts.after),
        from = String(facts.before);
      facts.before = `${from[0]}${Number(to[1]) + (Number(to[1]) > Number(from[1]) ? -2 : 2)}`;
    },
  ],
  [
    "king_flights",
    "positional-king-flight-actual",
    facts => {
      const opened = facts.opened as string[];
      facts.opened = [...opened, opened[0] === "a1" ? "h8" : "a1"];
    },
  ],
  [
    "rook_file",
    "positional-rook-semi-open-actual",
    facts => {
      facts.before = "open";
    },
  ],
];

for (const [feature, recording, change] of cases)
  test(`${recording} is not selected when the fact contradicts its wording`, () => {
    const pair = withFeature(feature, recording, change);
    expect(pair, `a fixture that selects ${recording}`).not.toBeNull();
    expect(recordings(pair![1])).not.toContain(recording);
  });
