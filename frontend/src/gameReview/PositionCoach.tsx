import { CornerUpLeft } from "lucide-react";
import MoveBadge from "../MoveBadge";
import ReviewCoach from "../ReviewCoach";
import EvaluationScore from "../EvaluationScore";
import type { Score } from "../evaluation";
import type { Game, Position, Report } from "./types";
import { gameReaction } from "../coach/reactions";
import { gameIntent } from "../dialogue/gameIntent";
import { useDialogue } from "../dialogue/useDialogue";
import DialogueText from "../dialogue/DialogueText";
import HumanInsight from "./HumanInsight";

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
  const utterance = useDialogue(explaining ? gameIntent({...input, explaining}) : intent);
  return (
    <ReviewCoach
      reaction={{...reaction, state: utterance.expression}}
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
      actions={
        <>
          <button
            aria-pressed={explaining}
            disabled={!cues && !errorAtPosition}
            onClick={onExplain}
          >
            {errorAtPosition
              ? "Retry analysis"
              : explaining
                ? "Hide why"
                : "Show why"}
          </button>
          {variation && (
            <button
              className="game-return"
              onClick={onReturnToGame}
              title="Return to game (Escape)"
            >
              <CornerUpLeft size={18} />
              Return to game
            </button>
          )}
        </>
      }
      context={
        <>
          <span title={bestMove ? `Best move: ${bestMove}` : undefined}>
            {bestMove ? (
              <>
                Best: <strong>{bestMove}</strong>
              </>
            ) : (
              "Move a piece to explore"
            )}
          </span>
          {report && <HumanInsight key={`${dialogueKey}:${report.practical?.input_digest}`} intent={intent} report={report} />}
        </>
      }
    >
      <DialogueText utterance={utterance} />
      {errorAtPosition && <p role="alert">{errorAtPosition}</p>}
    </ReviewCoach>
  );
}
