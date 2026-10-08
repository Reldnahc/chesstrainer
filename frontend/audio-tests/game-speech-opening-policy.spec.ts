import {expect, test} from "@playwright/test";
import type {Game} from "../src/gameReview/types";
import {gameIntent} from "../src/dialogue/gameIntent";
import {gameReaction} from "../src/coach/reactions";
import {humanInsightIntent, humanInsightLabels} from "../src/dialogue/humanClaims";
import {renderDialogue} from "../src/dialogue/neutral";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {robot} from "../src/dialogue/characters/robot";
import {bookRecordingId, deriveBookPresentation} from "../src/dialogue/openingPresentation";
import {selectGameRecording, selectGameSpeech} from "../src/audio/speech/gameSelection";
import {semanticFixtures} from "../tests/semantic-fixtures";

const games = semanticFixtures<Record<string, Game>>("review_speech_opening_fixtures.py");
const departure = {primaryId: "opening-departure", recordingId: "opening-departure"};
const states = ["hard-find", "unusual-strong", "natural-best", "natural-strong", "hard-defense-found"];
const coaches = [{id: "classic", personality: storyteller}, {id: "robot", personality: robot}];
// The Maia reading each fixture state shows in its badge; none is ever voiced.
const shownCodes: Record<string, string> = {"hard-find": "human_challenging", "unusual-strong": "human_rare",
  "natural-best": "human_natural_best", "natural-strong": "human_natural_strong", "hard-defense-found": "human_defense_found"};
const unvoiced = (id: string | null) => !(id ?? "").split("+").some(part => /^(?:human-|combo-|combined-)/.test(part));

function presentation(game: Game, ply: number, coach = coaches[0]) {
  const frame = game.frames[ply], report = frame.report!, key = `${game.id}:${ply}`;
  const reaction = gameReaction({key, frame, report, learner: game.orientation,
    explaining: false, error: false, pending: false});
  const intent = gameIntent({game, frame, report, ply, key, expression: reaction.state});
  const context = {game, frame, report, ply, intent, utterance: renderDialogue(intent, coach)};
  const child = humanInsightIntent(gameIntent({game, frame, report, ply, key, expression: reaction.state, human: true}));
  const insight = {intent: child, utterance: renderDialogue(child, coach)};
  return {context, insight};
}

for (const coach of coaches) {
  test(`${coach.id}: real recognized histories reach all eleven book slots and speak the book line beside each shown Maia reading`, () => {
    const observed = new Set<string>(), actors = new Set<string>();
    for (const state of states) {
      const slots = new Set<string>();
      // Identity changes select prose slots; all saved board/report facts and
      // production priorities remain intact, as in opening-dialogue.spec.ts.
      for (let seed = 0; seed < 24; seed++) {
        const game = structuredClone(games[state]);
        game.id = `opening-pair-${seed}`;
        for (let ply = 1; ply < game.frames.length; ply++) {
          game.orientation = game.frames[ply].actor!;
          const {context, insight} = presentation(game, ply, coach);
          const opening = deriveBookPresentation(context)!;
          expect(opening).toMatchObject({runStartPly: 1, runOrdinal: ply});
          const objectiveId = bookRecordingId(opening);
          expect(context.utterance.renderedClaims![0].code).toBe("book_sound");
          expect(selectGameRecording(context)).toBe(objectiveId);
          expect(insight.utterance.renderedClaims!.map(item => item.code)).toEqual([shownCodes[state]]);
          const speech = selectGameSpeech(context);
          expect(speech.primaryId).toBe(objectiveId);
          expect(speech.recordingId!.split("+")[0]).toBe(objectiveId);
          expect(unvoiced(speech.recordingId), speech.recordingId!).toBe(true);
          slots.add(objectiveId); observed.add(`${objectiveId}:${state}`); actors.add(game.orientation);
        }
      }
      expect([...slots].sort()).toEqual([
        ...Array.from({length: 3}, (_, i) => `book-opening-entry-${i + 1}`),
        ...Array.from({length: 8}, (_, i) => `book-opening-follow-${i + 1}`),
      ].sort());
    }
    expect(observed.size).toBe(55);
    expect([...actors].sort()).toEqual(["black", "white"]);
  });

  test(`${coach.id}: the first genuine book departure speaks its objective line after each shown strong Maia reading`, () => {
    const observed = new Set<string>();
    for (const state of states.filter(state => state !== "hard-defense-found")) {
      const game = games[`departure-${state}`], {context, insight} = presentation(game, 2, coach);
      expect(game.frames[1].report!.opening).toBeTruthy();
      expect(context.report.opening).toBeNull();
      expect(context.report.intelligence!.events.some(event => event.kind === "opening_departure")).toBe(true);
      const codes = context.utterance.renderedClaims!.map(item => item.code);
      // Maia stays in its badge; the departure leads the coach's line.
      expect(codes[0]).toBe("departure");
      expect(codes.some(code => humanInsightLabels[code])).toBe(false);
      expect(selectGameRecording(context)).toBe("opening-departure");
      expect(insight.utterance.renderedClaims!.map(item => item.code)).toEqual([shownCodes[state]]);
      expect(selectGameSpeech(context)).toEqual({...departure, variants: {...departure, squares: new Map()}});
      observed.add(state);
    }
    expect(observed.size).toBe(4);
  });
}
