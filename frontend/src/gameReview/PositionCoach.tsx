import MoveBadge from "../MoveBadge";
import ReviewCoach from "../ReviewCoach";
import EvaluationScore from "../EvaluationScore";
import type { Score } from "../evaluation";
import type { Game, Position, Report } from "./types";
import { gameReaction } from "../coach/reactions";
import { completionText } from "./narrativeText";

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
  const finish =
    reaction.state === "winning"
      ? "Checkmate. You finished the attack; the king has no legal escape."
      : reaction.state === "losing"
        ? "Checkmate. Your king has no legal escape. Let's look back for a way to stop the attack."
        : reaction.state === "draw"
          ? "The position is drawn. We can look back at the earlier decisions together."
          : null;
  const coachIntro =
    game.job?.status === "completed"
      ? completionText(game) || "Your review is ready. Select a move, jump to the next mistake, or move a piece to try an idea."
      : game.job?.status === "cancelled"
        ? "Your review is paused. Resume it below, or move a piece to explore."
        : game.job?.status === "failed" || (!game.job && !reviewStarting)
          ? "The review couldn't finish. Retry below, or explore the board while you wait."
          : "I'm reviewing both sides. The move ratings will appear as they're ready. You can explore the board while you wait.";
  return (
    <ReviewCoach
      reaction={reaction}
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
      <p aria-live="polite">
        {explaining
          ? cues!.caption
          : finish ||
            report?.coach ||
            (errorAtPosition
              ? "You can still explore the board. Engine coaching is unavailable for this position."
              : !actor
                ? coachIntro
                : "I'm checking this move and the opponent's strongest reply…")}
      </p>
      {errorAtPosition && <p role="alert">{errorAtPosition}</p>}
    </ReviewCoach>
  );
}
