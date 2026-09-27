import MoveBadge from "../MoveBadge";
import ReviewCoach from "../ReviewCoach";
import EvaluationScore from "../EvaluationScore";
import type { Score } from "../evaluation";
import type { Game, Position, Report } from "./types";
import { gameReaction } from "../coach/reactions";
import { gameIntent } from "../dialogue/gameIntent";
import { useDialogue } from "../dialogue/useDialogue";
import DialogueText from "../dialogue/DialogueText";

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
  if (!actor && !report && game.narrative?.complete && !errorAtPosition) {
    reaction.state = "explaining";
    reaction.key += `:complete:${game.narrative.input_digest}`;
  }
  const utterance = useDialogue(gameIntent({game, report, frame, ply, variation,
    key: dialogueKey, expression: reaction.state, explaining,
    error: !!errorAtPosition || game.job?.status === "failed",
    pending: !!actor || reviewStarting || ["queued", "running"].includes(game.job?.status ?? ""),
  }));
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
          <span title={bestMove ? `Best move: ${bestMove}` : undefined}>
            {bestMove ? (
              <>
                Best: <strong>{bestMove}</strong>
              </>
            ) : (
              "Move a piece to explore"
            )}
          </span>
        </>
      }
    >
      <DialogueText utterance={utterance} />
      {errorAtPosition && <p role="alert">{errorAtPosition}</p>}
    </ReviewCoach>
  );
}
