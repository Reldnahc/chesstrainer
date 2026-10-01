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
import catalogue from "../src/audio/speech/meanings.json" with {type: "json"};

const root = path.resolve("..");
const python = process.env.TEST_PYTHON || path.join(root, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
const games: Record<string, Game> = JSON.parse(execFileSync(python,
  [path.join(root, "backend/tests/review_speech_tactical_fixtures.py")],
  {encoding: "utf8", cwd: root, maxBuffer: 8 * 1024 * 1024}));
const pairs = new Map<string, string>(catalogue.meanings.flatMap(item => "primary" in item && "secondary" in item
  ? [[`${item.primary}:${item.secondary}`, item.id] as const] : []));

for (const coach of [{id: "classic", personality: storyteller}, {id: "robot", personality: robot}]) {
  for (const [key, game] of Object.entries(games)) {
    test(`${coach.id}: ${key} survives real tactical evidence and rendered priority`, () => {
      const [objectiveId, humanId] = key.split(":");
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
      expect(selectGameRecording({...context, ...insight, surface: "human-insight"})).toBe(humanId);
      expect(pairs.get(key)).toBeDefined();
      expect(selectGameSpeech(context, insight).recordingId).toBe(pairs.get(key));
    });
  }
}

test("tactical producer proof covers every remaining admitted role and human-state pair", () => {
  const existing = new Set([
    "tactic-fork-played", "tactic-fork-allowed", "tactic-fork-missed",
    "tactic-pin-played", "tactic-skewer-allowed",
  ]);
  const expected = catalogue.meanings.flatMap(item => "primary" in item && "secondary" in item
    && item.primary?.startsWith("tactic-") && !existing.has(item.primary)
    ? [`${item.primary}:${item.secondary}`] : []);
  expect(Object.keys(games).sort()).toEqual(expected.sort());
  expect(expected).toHaveLength(62);
});
