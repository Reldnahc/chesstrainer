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
import {selectGameSpeech} from "../audio/speech/gameSelection";
import {useCoachSpeech} from "../audio/speech/useCoachSpeech";
import {coachRecording} from "../audio/speech/voiceBank";

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
  const selection = {...speechContext, intent: displayedIntent, utterance};
  const speech = selectGameSpeech(selection, explaining ? undefined : insight);
  const {primaryId} = speech;
  const recordingId = coachRecording(utterance.coachId, speech.recordingId) ? speech.recordingId : primaryId;
  // One move gets one spoken line. A second claim never adds its own Listen
  // control; a supported pairing is already one whole combined recording.
  const voice = useCoachSpeech({scopeKey: `game:${positionKey}`, recordingId, utterance,
    automaticEventId: speechEventId, ready: !speechPending,
    manualRecordingIds: primaryId ? [primaryId] : []});
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
      insight={report && <HumanInsight key={`${dialogueKey}:${report.practical?.input_digest}`} presentation={insight} report={report}
        speechContext={speechContext} speechScopeKey={`game:${positionKey}:human`}
        onManualSpeech={() => voice.consumeAutomatic(speechEventId)} />}
    >
      <DialogueText utterance={utterance} />
      {errorAtPosition && <Notice announcement="alert" tone="error" appearance="inline">{errorAtPosition}</Notice>}
    </ReviewCoach>
  );
}
