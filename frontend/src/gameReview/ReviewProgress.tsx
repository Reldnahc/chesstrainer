import type { Game } from "./types";

export default function ReviewProgress({
  game,
  running,
  busy,
  reviewStarting,
  start,
  cancel,
}: {
  game: Game;
  running: boolean;
  busy: boolean;
  reviewStarting: boolean;
  start: () => Promise<void>;
  cancel: () => Promise<void>;
}) {
  if (game.job?.status === "completed" && !game.job.error) return null;
  const refining = game.job?.phase === "refinement";
  return (
    <section className="game-progress" aria-label="Review progress">
      {game.job?.status !== "completed" && (
        <>
          <div className="row-between">
            <span>
              {refining && game.job
                ? `${game.job.refinement_completed}/${game.job.refinement_total} positions investigated`
                : game.job
                  ? `${game.job.completed}/${game.job.total} moves reviewed`
                  : `${game.frames.length - 1} moves to review`}
            </span>
            {running ? (
              <button disabled={busy || game.job?.cancel_requested} onClick={cancel}>
                Pause review
              </button>
            ) : (
              <button className="primary" disabled={busy || reviewStarting} onClick={start}>
                {reviewStarting
                  ? "Starting review…"
                  : !game.job || game.job.status === "failed"
                    ? "Retry review"
                    : "Resume review"}
              </button>
            )}
          </div>
          {game.job && (
            <progress
              value={refining ? game.job.refinement_completed : game.job.completed}
              max={(refining ? game.job.refinement_total : game.job.total) || 1}
              aria-label="Game review progress"
            />
          )}
          {running && (
            <p role="status">
              {game.job?.cancel_requested
                ? refining ? "Pausing investigation…" : "Finishing active moves…"
                : game.job?.status === "queued"
                  ? "Review queued. You can explore while you wait."
                  : refining
                    ? "Checking selected positions more deeply. Your review is ready to explore."
                    : "Reviewing both sides…"}
            </p>
          )}
        </>
      )}
      {game.job?.error && <p className="small" role="alert">{game.job.error}</p>}
    </section>
  );
}
