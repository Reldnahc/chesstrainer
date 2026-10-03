import {expect, test} from "@playwright/test";
import {execFileSync} from "node:child_process";
import path from "node:path";
import type {Game} from "../src/gameReview/types";
import {gameReaction} from "../src/coach/reactions";
import {gameIntent} from "../src/dialogue/gameIntent";
import {humanInsightIntent, humanInsightLabels} from "../src/dialogue/humanClaims";
import {renderDialogue} from "../src/dialogue/neutral";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {robot} from "../src/dialogue/characters/robot";
import {selectGameRecording, selectGameSpeech} from "../src/audio/speech/gameSelection";
import {sequenceRecordingId} from "../src/audio/speech/sequence";
import catalogue from "../src/audio/speech/meanings.json" with {type: "json"};

const root = path.resolve("..");
const python = process.env.TEST_PYTHON || path.join(root, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
const games: Record<string, Game> = JSON.parse(execFileSync(python,
  [path.join(root, "backend/tests/review_speech_tactical_fixtures.py")],
  {encoding: "utf8", cwd: root, maxBuffer: 8 * 1024 * 1024}));
// The Maia reading each fixture shows in its badge; none is ever voiced.
const shownCodes: Record<string, string> = {"human-natural-error": "human_natural_error", "human-unusual-strong": "human_rare",
  "human-hard-defense-missed": "difficult_defense", "human-hard-find": "human_challenging",
  "human-hard-defense-found": "human_defense_found", "human-natural-best": "human_natural_best",
  "human-natural-strong": "human_natural_strong"};

for (const coach of [{id: "classic", personality: storyteller}, {id: "robot", personality: robot}]) {
  for (const [key, game] of Object.entries(games)) {
    test(`${coach.id}: ${key} survives real tactical evidence and speaks only the objective line`, () => {
      const [objectiveId, shown] = key.split(":");
      const ply = game.frames.length - 1, frame = game.frames[ply], report = frame.report!;
      const reaction = gameReaction({key, frame, report, learner: game.orientation,
        explaining: false, pending: false, error: false});
      const intent = gameIntent({key, game, frame, report, ply, expression: reaction.state});
      const context = {game, frame, report, ply, intent, utterance: renderDialogue(intent, coach)};
      const child = humanInsightIntent(intent);
      const insight = {intent: child, utterance: renderDialogue(child, coach)};
      const claimIndex = context.utterance.renderedClaims!.findIndex(claim => !humanInsightLabels[claim.code]);
      expect(claimIndex).toBeGreaterThanOrEqual(0);
      expect(selectGameRecording({...context, claimIndex})).toBe(objectiveId);
      expect(insight.utterance.renderedClaims!.map(item => item.code)).toEqual([shownCodes[shown]]);
      const speech = selectGameSpeech(context);
      expect(speech.primaryId).toBe(objectiveId);
      // A following objective sentence joins back to back; a Maia sentence adds nothing.
      const rendered = context.utterance.renderedClaims!;
      const second = claimIndex === 0 && rendered[1] && !humanInsightLabels[rendered[1].code]
        ? selectGameRecording({...context, claimIndex: 1}) : null;
      expect(speech.recordingId).toBe(second && second !== objectiveId ? sequenceRecordingId([objectiveId, second]) : objectiveId);
      expect(speech.recordingId).not.toMatch(/(?:^|\+)(?:human-|combo-|combined-)/);
    });
  }
}

test("tactical producer proof keeps its role and shown Maia-state fixtures", () => {
  const keys = Object.keys(games), meanings = new Set(catalogue.meanings.map(item => item.id));
  expect(keys).toHaveLength(62);
  expect(new Set(keys).size).toBe(62);
  for (const key of keys) {
    const [objectiveId, shown] = key.split(":");
    expect(objectiveId).toMatch(/^tactic-[a-z-]+-(?:played|allowed|missed)$/);
    expect(meanings.has(objectiveId)).toBe(true);
    expect(shownCodes[shown]).toBeDefined();
  }
});
