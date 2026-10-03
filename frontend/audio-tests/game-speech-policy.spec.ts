import {expect, test} from "@playwright/test";
import type {Game} from "../src/gameReview/types";
import {gameIntent} from "../src/dialogue/gameIntent";
import {humanInsightIntent, humanInsightLabels} from "../src/dialogue/humanClaims";
import {renderDialogue} from "../src/dialogue/neutral";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {robot} from "../src/dialogue/characters/robot";
import {gameReaction} from "../src/coach/reactions";
import {selectGameRecording, selectGameSpeech, soleMaiaIds, type GameSpeechContext} from "../src/audio/speech/gameSelection";
import {semanticFixtures} from "../tests/semantic-fixtures";

const games = {
  ...semanticFixtures<Record<string, Game>>("review_speech_policy_fixtures.py"),
  ...semanticFixtures<Record<string, Game>>("review_speech_relationship_fixtures.py"),
};
const coaches = [{id: "classic", personality: storyteller}, {id: "robot", personality: robot}];
// Objective explanations that the policy profiles reach while a Maia reading
// is also available. Each speaks its own objective line; Maia is voiced only
// when it is the ply's whole content.
const observedFamilies = [
  "evaluation-loss", "allowed-mate", "missed-mate", "immediate-capture", "recognized-opening",
  "cause-abandoned-defender", "cause-opponent-threat-recognition", "cause-avoiding-bad-trades",
  "tactic-fork-played", "tactic-pin-played", "tactic-fork-allowed", "tactic-skewer-allowed", "tactic-fork-missed",
  "sound-sacrifice", "only-playable-move", "only-advantage-resource",
  "positional-rook-open-actual", "positional-rook-semi-open-actual", "clock-low", "clock-fast", "clock-long",
  "positional-bishop-pair-actual", "positional-passer-advance-actual", "positional-king-flight-actual",
  "recovery", "recovery-assisted", "chance-taken", "chance-missed", "support-restored", "advantage-converted",
];

function presentation(name: string, coach = coaches[0], game = structuredClone(games[name])) {
  const ply = game.frames.length - 1, frame = game.frames[ply], report = frame.report!;
  const reaction = gameReaction({key: name, frame, report, learner: game.orientation,
    explaining: false, error: false, pending: false});
  const intent = gameIntent({key: name, game, frame, report, ply, expression: reaction.state});
  const context: GameSpeechContext = {game, frame, report, ply, intent, utterance: renderDialogue(intent, coach)};
  const child = humanInsightIntent(intent);
  const insight = {intent: child, utterance: renderDialogue(child, coach)};
  return {context, insight};
}

for (const coach of coaches) {
  test(`${coach.id}: coherent policy profiles show all seven insights and voice only a sole one`, () => {
    const observed = new Set<string>(), shown = new Set<string>();
    let humanFirst = 0, badgeOnly = 0;
    for (const name of Object.keys(games)) {
      const {context, insight} = presentation(name, coach);
      for (const item of insight.utterance.renderedClaims ?? []) shown.add(item.code);
      const claims = context.utterance.renderedClaims!;
      const maiaOnly = context.intent.claims.every(item => humanInsightLabels[item.code]);
      const objective = claims.map((item, claimIndex) => {
        const id = selectGameRecording({...context, claimIndex});
        if (humanInsightLabels[item.code])
          expect(id, `${name}: Maia claim ${item.code}`).toBe(maiaOnly ? soleMaiaIds[item.code] ?? null : null);
        return id;
      }).filter((id): id is string => !!id);
      const speech = selectGameSpeech(context);
      const parts = speech.recordingId?.split("+") ?? [];
      expect(parts.every(id => objective.includes(id)), `${name}: ${speech.recordingId}`).toBe(true);
      expect(parts.some(id => /^(?:combo-|combined-)/.test(id) || (!maiaOnly && id.startsWith("human-")))).toBe(false);
      const lead = maiaOnly ? 0 : claims.findIndex(item => !humanInsightLabels[item.code]);
      expect(speech.primaryId, name).toBe(lead < 0 ? null : selectGameRecording({...context, claimIndex: lead}));
      if (!insight.intent.claims.length || !speech.primaryId) continue;
      observed.add(speech.primaryId);
      if (lead > 0) humanFirst++;
      if (!claims.some(item => humanInsightLabels[item.code])) badgeOnly++;
    }
    expect([...observed]).toEqual(expect.arrayContaining(observedFamilies));
    expect([...shown].sort()).toEqual(Object.keys(humanInsightLabels).sort());
    expect(humanFirst).toBeGreaterThan(0);
    expect(badgeOnly).toBeGreaterThan(0);
  });

  // The bubble's recorded objective sentences play back to back; Maia adds nothing.
  const plain = (context: GameSpeechContext) => {
    const first = selectGameRecording(context), second = selectGameRecording({...context, claimIndex: 1});
    return first && second ? `${first}+${second}` : first;
  };

  test(`${coach.id}: the selected defense insight is shown while the objective line speaks alone`, () => {
    const {context, insight} = presentation("cause-abandoned_defender-white-narrow-preferred-unusual", coach);
    expect(context.intent.claims.map(item => item.code)).toEqual(expect.arrayContaining(["human_natural_error", "difficult_defense"]));
    expect(insight.intent.claims.map(item => item.code)).toEqual(["difficult_defense"]);
    expect(selectGameSpeech(context).primaryId).toBe("cause-abandoned-defender");
    expect(selectGameSpeech(context).recordingId).toBe(plain(context));
  });

  test(`${coach.id}: a back-rank mating witness keeps the higher mate explanation`, () => {
    for (const role of ["allowed", "missed"]) for (const profile of ["preferred", "preferred-unusual"]) {
      const {context} = presentation(`back-rank-${role}-narrow-${profile}`, coach);
      expect(context.report!.intelligence!.events).toEqual(expect.arrayContaining([
        expect.objectContaining({kind: "tactic", facts: expect.objectContaining({motif: "back_rank", role})}),
      ]));
      expect(selectGameRecording(context)).toBe(`${role}-mate`);
      expect(selectGameSpeech(context).recordingId).toBe(plain(context));
    }
  });

  test(`${coach.id}: late unavailable policy removes the chip without changing the objective speech`, () => {
    const {context} = presentation("cause-abandoned_defender-white-preferred", coach);
    const fallback = plain(context);
    context.report!.human!.status = "unavailable";
    expect(selectGameSpeech(context).recordingId).toBe(fallback);
    const current = presentation("cause-abandoned_defender-white-preferred", coach, context.game);
    expect(current.insight.intent.claims).toEqual([]);
    expect(selectGameSpeech(current.context).recordingId).toBe(fallback);
  });

  test(`${coach.id}: opponent and variation contexts keep their own objective speech`, () => {
    const original = presentation("cause-abandoned_defender-white-preferred", coach);
    const game = structuredClone(original.context.game);
    game.orientation = "black";
    const opponent = presentation("cause-abandoned_defender-white-preferred", coach, game);
    expect(opponent.insight.intent.claims).toEqual([]);
    expect(selectGameSpeech(opponent.context).recordingId).toBe(plain(opponent.context));
    const parent = original.context;
    const intent = gameIntent({...parent, key: "branch", variation: true, expression: parent.intent.expression});
    const branch = {...parent, variation: true, intent, utterance: renderDialogue(intent, coach)};
    expect(selectGameSpeech(branch).recordingId).toBe(plain(branch));
  });
}
