import { useEffect } from "react";
import MoveBadge from "../MoveBadge";
import ReviewCoach from "../ReviewCoach";
import Button from "../Button";
import Notice from "../Notice";
import ReturnButton from "../ReturnButton";
import EvaluationScore from "../EvaluationScore";
import type { Score } from "../evaluation";
import type { Game, Position, Report } from "./types";
import { gameReaction } from "../coach/reactions";
import { gameIntent } from "../dialogue/gameIntent";
import { useDialogue } from "../dialogue/useDialogue";
import {humanInsightIntent} from "../dialogue/humanClaims";
import DialogueText from "../dialogue/DialogueText";
import HumanInsight from "./HumanInsight";
import {selectGameOpener, selectGameSpeech} from "../audio/speech/gameSelection";
import {useCoachSpeech} from "../audio/speech/useCoachSpeech";
import {coachRecording, hasCoachVoice} from "../audio/speech/voiceBank";
import {useSpokenText} from "../audio/speech/spokenText";
import CoachMovesLine, {movesLineFacts, movesLineText} from "./CoachMovesLine";
import {useOptionalAudioPreferences} from "../audio/AudioProvider";
import {useOptionalCoachPreferences} from "../coach/CoachProvider";

export default function PositionCoach({
  game,
  report,
  frame,
  actor,
  score,
  bestMove,
  explaining,
  cues,
  errorAtPosition,
  reviewStarting,
  onExplain,
  onReturnToGame,
  positionKey,
  dialogueKey,
  ply,
  variation,
  speechPending = false,
  speechEventId,
  speechOpening = false,
  onVoicePlaying,
}: {
  game: Game;
  report?: Report | null;
  frame?: Position | null;
  actor: string | null;
  score?: Score | null;
  bestMove?: string | null;
  explaining: boolean;
  cues: Report["board_cues"];
  errorAtPosition: string | null;
  reviewStarting: boolean;
  onExplain: () => void;
  onReturnToGame: () => void;
  positionKey: string;
  dialogueKey: string;
  ply: number;
  variation: boolean;
  speechPending?: boolean;
  speechEventId?: string;
  speechOpening?: boolean;
  /** A live game waits for the coach's line to finish before the bot answers. */
  onVoicePlaying?: (playing: boolean) => void;
}) {
  const reaction = gameReaction({
    key: positionKey,
    frame,
    report,
    learner: game.orientation,
    explaining,
    error: !!errorAtPosition || (!actor && game.job?.status === "failed"),
    pending:
      !!actor ||
      reviewStarting ||
      ["queued", "running"].includes(game.job?.status ?? ""),
  });
  const input = {game, report, frame, ply, variation,
    key: dialogueKey, expression: reaction.state,
    error: !!errorAtPosition || game.job?.status === "failed",
    pending: !!actor || reviewStarting || ["queued", "running"].includes(game.job?.status ?? ""),
  };
  const intent = gameIntent(input);
  const displayedIntent = explaining ? gameIntent({...input, explaining}) : intent;
  const utterance = useDialogue(displayedIntent);
  const insightIntent = humanInsightIntent(intent);
  const insight = {intent: insightIntent, utterance: useDialogue(insightIntent)};
  // A background game review and the presence of a mover are not loading
  // states for this position. Only its own unresolved navigation blocks voice.
  const speechContext = {game, report, frame, ply, variation, pending: speechPending,
    error: !!errorAtPosition || (!report && game.job?.status === "failed")};
  // anyCoach: a coach without a recorded bank still shows its script's line.
  const selection = {...speechContext, intent: displayedIntent, utterance, anyCoach: true};
  // A Maia reading is voiced only when it is all this ply has to say.
  const speech = selectGameSpeech(selection);
  const {primaryId} = speech;
  const coachId = utterance.coachId, voiced = hasCoachVoice(coachId);
  const selected = coachRecording(coachId, speech.recordingId) ? speech.recordingId : primaryId;
  // The greeting is the start's own line, whether the review just opened or the
  // learner returned there, so the bubble's no-report prose does not gate it.
  const openerId = selectGameOpener({ply, variation, report, frame,
    error: !!errorAtPosition || game.job?.status === "failed"});
  const opener = openerId && coachRecording(coachId, openerId) ? openerId : null;
  const recordingId = opener ?? selected;
  // The bubble shows what the coach says: a recorded coach's exact playback
  // line, or the coach's script line for a meaning not yet recorded. "Show why"
  // keeps the written explanation, where the concrete detail lives, and
  // selection keeps validating against the written utterance throughout.
  const spokenId = explaining ? null : voiced ? recordingId : openerId ?? speech.recordingId;
  const spokenLine = useSpokenText(coachId, spokenId);
  // A script that lacks one sentence of a pair still speaks the lead.
  const spokenLead = useSpokenText(coachId, explaining || voiced || openerId ? null : primaryId);
  const spoken = spokenLine ?? spokenLead, spokenSource = spokenLine ? spokenId : spokenLead ? primaryId : null;
  const displayed = !spoken ? utterance : openerId
    ? {...utterance, id: `${utterance.id}:greeting`, text: spoken, speechText: spoken}
    : {...utterance, text: spoken, speechText: spoken};
  const moves = spoken && !openerId ? movesLineFacts({report, frame, intent}) : null;
  // A game can load before saved voice preferences, and opening a finished
  // review restarts its session, which begins a new analysis epoch and so a new
  // speech scope. Holding the greeting until both settle keeps it a fresh event
  // rather than consumed hydration or a line cancelled by the scope change.
  const preferencesReady = !!useOptionalCoachPreferences()?.ready && !!useOptionalAudioPreferences()?.ready;
  const voice = useCoachSpeech({scopeKey: `game:${positionKey}`, recordingId, utterance: opener ? undefined : utterance,
    automaticEventId: speechOpening && (!preferencesReady || reviewStarting) ? null : speechEventId, ready: !speechPending,
    manualRecordingIds: [primaryId, explaining ? null : speech.recordingId].filter((id): id is string => !!id)});
  useEffect(() => {
    onVoicePlaying?.(voice.playing);
  }, [voice.playing, onVoicePlaying]);
  return (
    <ReviewCoach
      reaction={{...reaction, state: utterance.expression}}
      voice={voice}
      title={
        report ? (
          <MoveBadge label={report.label}>
            <span className="coach-rated-move">
              <span className="sr-only">{actor} · </span>
              {frame?.san || "Move"} is{" "}
              {["Mistake", "Miss", "Blunder", "Inaccuracy"].includes(
                report.label,
              )
                ? report.label === "Inaccuracy"
                  ? "an "
                  : "a "
                : ""}
              <span className="coach-quality-name">{report.label}</span>
            </span>
          </MoveBadge>
        ) : (
          <strong>
            {actor ? `${actor} · ${frame?.san || "Move"}` : "Your coach"}
          </strong>
        )
      }
      evaluation={<EvaluationScore score={score} />}
      portraitCaption={
        bestMove && (
          <span className="coach-best-move" title={`Best move: ${bestMove}`}>
            <span>Best</span>
            <strong>{bestMove}</strong>
          </span>
        )
      }
      actions={
        <>
          <Button
            size="compact"
            aria-pressed={explaining}
            disabled={!cues && !errorAtPosition}
            onClick={onExplain}
          >
            {errorAtPosition
              ? "Retry analysis"
              : explaining
                ? "Hide why"
                : "Show why"}
          </Button>
          {variation && (
            <ReturnButton
              onClick={onReturnToGame}
              title="Return to game (Escape)"
            >
              Return to game
            </ReturnButton>
          )}
        </>
      }
      detail={moves && <CoachMovesLine facts={moves} />}
      insight={report && <HumanInsight key={`${dialogueKey}:${report.practical?.input_digest}`} presentation={insight} report={report} />}
    >
      <DialogueText utterance={displayed} recordingId={spokenSource} announcedDetail={moves && movesLineText(moves)} />
      {errorAtPosition && <Notice announcement="alert" tone="error" appearance="inline">{errorAtPosition}</Notice>}
    </ReviewCoach>
  );
}
