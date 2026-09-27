import MoveBadge from "../MoveBadge";
import { AccuracyReadout } from "./Players";
import type { Game } from "./types";

const labels = [
  "Brilliant",
  "Great",
  "Best",
  "Good",
  "Book",
  "Inaccuracy",
  "Mistake",
  "Miss",
  "Blunder",
];

export default function ReviewSummary({
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
  const last = game.frames.length - 1;
  const refining = game.job?.phase === "refinement";
  const summary = labels.map((label) => ({
    label,
    white: game.frames.filter(
      (f) => f.actor === "white" && f.report?.label === label,
    ).length,
    black: game.frames.filter(
      (f) => f.actor === "black" && f.report?.label === label,
    ).length,
  }));
  return (
    <div className="game-review-tools">
      <section className="game-progress">
        {game.job?.status !== "completed" && (
          <>
            <div className="row-between">
              <span>
                {refining && game.job
                  ? `${game.job.refinement_completed}/${game.job.refinement_total} positions investigated`
                  : game.job
                  ? `${game.job.completed}/${game.job.total} moves reviewed`
                  : `${last} moves to review`}
              </span>
              {running ? (
                <button
                  disabled={busy || game.job?.cancel_requested}
                  onClick={cancel}
                >
                  Pause review
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={busy || reviewStarting}
                  onClick={start}
                >
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
                      ? "Investigating critical moments. Your review is ready to explore."
                      : "Reviewing both sides…"}
              </p>
            )}
          </>
        )}
        {game.job?.error && (
          <p className="small" role="alert">
            {game.job.error}
          </p>
        )}
      </section>
      <details className="game-summary">
        <summary>
          Move quality
          {game.job?.status === "completed" ? " · complete game" : ""}
        </summary>
        <table aria-label="Move quality and accuracy">
          <thead>
            <tr>
              <th scope="col">Move quality</th>
              <th scope="col">White</th>
              <th scope="col">Black</th>
            </tr>
          </thead>
          <tbody>
            <tr className="game-summary-accuracy">
              <th scope="row">Accuracy</th>
              {(["white", "black"] as const).map((color) => (
                <td key={color}>
                  <AccuracyReadout
                    color={color}
                    accuracy={game.accuracy}
                    complete={game.job?.status === "completed"}
                    summary
                  />
                </td>
              ))}
            </tr>
            {summary.map((s) => (
              <tr key={s.label}>
                <th scope="row">
                  <MoveBadge label={s.label} />
                </th>
                <td>{s.white}</td>
                <td>{s.black}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
