import {createRoot} from "react-dom/client";
import Button from "../../src/Button";
import {AudioProvider, useAudioPreferences, useCurrentSpeechPlayback} from "../../src/audio/AudioProvider";
import {CoachProvider, useCoachPreferences} from "../../src/coach/CoachProvider";
import {getCoach} from "../../src/coach/registry";
import {gameReaction} from "../../src/coach/reactions";
import {gameIntent} from "../../src/dialogue/gameIntent";
import {humanInsightIntent} from "../../src/dialogue/humanClaims";
import {renderDialogue} from "../../src/dialogue/neutral";
import PositionCoach from "../../src/gameReview/PositionCoach";
import type {Game} from "../../src/gameReview/types";
import "../../src/coach-presentation.css";

export type PositionCoachSpeechSelection = {game: Game; speechEventId?: string};
export type PositionCoachSpeechHarness = {
  update: (patch: Partial<PositionCoachSpeechSelection>) => void;
  unmount: () => void;
};
export type PositionCoachSpeechState = {
  ready: boolean;
  coachId: string;
  speechEventId: string | null;
  observed: string | null;
  observedCoach: string | null;
  utteranceId: string;
  humanIntentId: string;
  humanUtteranceId: string;
  humanText: string;
  intentCodes: string[];
  renderedCodes: string[];
};

/** Mount the actual consumer; the parallel projection only exposes its claim audit. */
export function mountPositionCoachSpeech(game: Game): PositionCoachSpeechHarness {
  const container = document.createElement("main");
  container.id = "position-coach-speech-harness";
  container.style.cssText = "padding:16px;max-width:760px;margin:0 auto;container-type:inline-size";
  document.body.append(container);
  const root = createRoot(container);
  let selection: PositionCoachSpeechSelection = {game};

  function Experience({game: current, speechEventId}: PositionCoachSpeechSelection) {
    const audio = useAudioPreferences(), coach = useCoachPreferences();
    const observed = useCurrentSpeechPlayback();
    const frame = current.frames[1], report = frame.report;
    const actor = frame.turn === "white" ? "Black" : "White";
    const positionKey = `${current.id}:fixture:1:`, dialogueKey = `${current.id}:1:`;
    const pending = !!actor || ["queued", "running"].includes(current.job?.status ?? "");
    const error = current.job?.status === "failed";
    const reaction = gameReaction({key: positionKey, frame, report, learner: current.orientation,
      explaining: false, error, pending});
    const intent = gameIntent({game: current, report, frame, ply: 1, variation: false,
      key: dialogueKey, expression: reaction.state, error, pending});
    const utterance = renderDialogue(intent, getCoach(coach.preferences.coach_id));
    const humanIntent = humanInsightIntent(intent);
    const human = renderDialogue(humanIntent, getCoach(coach.preferences.coach_id));
    const state: PositionCoachSpeechState = {
      ready: audio.ready && coach.ready, coachId: coach.preferences.coach_id,
      speechEventId: speechEventId ?? null,
      observed: observed?.recordingId ?? null, observedCoach: observed?.coachId ?? null,
      utteranceId: utterance.id, intentCodes: intent.claims.map(item => item.code),
      humanIntentId: humanIntent.id, humanUtteranceId: human.id, humanText: human.text,
      renderedCodes: utterance.renderedClaims?.map(item => item.code) ?? [],
    };
    return <>
      <Button onClick={() => {}}>Unlock audio</Button>
      <output hidden data-testid="position-coach-speech-state">{JSON.stringify(state)}</output>
      <PositionCoach game={current} frame={frame} report={report} actor={actor}
        score={report?.white_score} bestMove={report?.best.san} explaining={false}
        cues={report?.board_cues ?? null} errorAtPosition={null} reviewStarting={false}
        onExplain={() => {}} onReturnToGame={() => {}}
        positionKey={positionKey} dialogueKey={dialogueKey} ply={1} variation={false}
        speechPending={false} speechEventId={speechEventId} />
    </>;
  }

  const render = () => root.render(<CoachProvider><AudioProvider>
    <Experience {...selection} />
  </AudioProvider></CoachProvider>);
  render();
  return {
    update: patch => {selection = {...selection, ...patch}; render();},
    unmount: () => {root.unmount(); container.remove();},
  };
}
