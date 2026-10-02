import {expect, test} from "@playwright/test";
import type {Game} from "../src/gameReview/types";
import {gameReaction} from "../src/coach/reactions";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {robot} from "../src/dialogue/characters/robot";
import {gameIntent} from "../src/dialogue/gameIntent";
import {renderDialogue} from "../src/dialogue/neutral";
import {humanInsightIntent, humanInsightLabels, type HumanInsightPresentation} from "../src/dialogue/humanClaims";
import {selectGameRecording, selectGameSpeech, type GameSpeechContext} from "../src/audio/speech/gameSelection";
import {semanticFixtures} from "../tests/semantic-fixtures";
import meanings from "../src/audio/speech/meanings.json" with {type: "json"};

const games = semanticFixtures<Record<string, Game>>("review_speech_combination_fixtures.py");
function prepare(name: string, coachId: string) {
  const game = structuredClone(games[name]), frame = game.frames[1], report = frame.report!;
  const key = `prepared-${name}`, coach = {id: coachId, personality: coachId === "classic" ? storyteller : robot};
  const reaction = gameReaction({key, frame, report, learner: game.orientation,
    explaining: false, error: false, pending: false});
  const intent = gameIntent({game, frame, report, ply: 1, key, expression: reaction.state});
  const context: GameSpeechContext = {game, frame, report, ply: 1, intent, utterance: renderDialogue(intent, coach)};
  const child = humanInsightIntent(intent);
  const insight: HumanInsightPresentation = {intent: child, utterance: renderDialogue(child, coach)};
  return {context, insight};
}

for (const coachId of ["classic", "robot"]) {
  for (const cause of ["abandoned_defender", "opponent_threat_recognition", "avoiding_bad_trades"])
    for (const color of ["white", "black"]) test(`${coachId}: ${color} ${cause} joins the independently displayed insight without lengthening the bubble`, () => {
      const {context, insight} = prepare(`cause-${cause}-${color}`, coachId);
      expect(context.utterance.renderedClaims!.some(item => humanInsightLabels[item.code])).toBe(false);
      expect(insight.utterance.renderedClaims!.map(item => item.code)).toEqual(["human_natural_error"]);
      const base = selectGameSpeech(context);
      // A position can support several causes. Use the one actually displayed,
      // never the fixture's name or a hidden lower-priority finding.
      const displayed = context.utterance.renderedClaims![0].code;
      expect(displayed).toMatch(/^cause_/);
      expect(base.primaryId).toBe(displayed.replaceAll("_", "-"));
      // A second recorded bubble sentence follows the first in the same playback.
      const second = selectGameRecording({...context, claimIndex: 1});
      expect(base.recordingId).toBe(second ? `${base.primaryId}+${second}` : base.primaryId);
      const combined = meanings.meanings.find(item => "primary" in item && item.primary === base.primaryId
        && item.secondary === "human-natural-error");
      expect(combined).toBeDefined();
      expect(selectGameSpeech(context, insight)).toEqual({...base,
        recordingId: combined!.id});
    });

  test(`${coachId}: prepared insight rejects another parent, coach, render trace or stale policy`, () => {
    const initial = prepare("evaluation-natural", coachId);
    expect(selectGameSpeech(initial.context, initial.insight).recordingId).toBe("combined-evaluation-loss-with-human-natural-error");
    for (const mutation of [
      (context: GameSpeechContext, insight: HumanInsightPresentation) => {insight.intent.id = "another-parent:human";},
      (context: GameSpeechContext, insight: HumanInsightPresentation) => {insight.utterance.coachId = coachId === "classic" ? "robot" : "classic";},
      (context: GameSpeechContext, insight: HumanInsightPresentation) => {insight.utterance.intentId = "previous-insight";},
      (context: GameSpeechContext, insight: HumanInsightPresentation) => {insight.utterance.renderedClaims = [];},
      (context: GameSpeechContext, insight: HumanInsightPresentation) => {insight.utterance.trace.variants[0].sourceIds = ["other-evidence"];},
      (context: GameSpeechContext) => {context.report!.practical!.human_evidence_id = "previous-policy";},
    ]) {
      const {context, insight} = prepare("evaluation-natural", coachId);
      mutation(context, insight);
      expect(selectGameSpeech(context, insight).recordingId).toBe("evaluation-loss");
    }
  });

  test(`${coachId}: prepared human facts cannot create an absent objective explanation`, () => {
    const {context, insight} = prepare("human-without-objective", coachId);
    expect(context.utterance.renderedClaims!.map(item => item.code)).toEqual(["human_rare"]);
    expect(selectGameSpeech(context, insight).recordingId).toBe("human-unusual-strong");
  });
}
