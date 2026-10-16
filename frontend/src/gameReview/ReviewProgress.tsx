import Button from "../Button";
import Notice from "../Notice";
import Reveal from "../Reveal";
import type { Game } from "./types";
import { plural, pluralWord } from "../format";

type ReviewProgressProps = {
  game: Game;
  running: boolean;
  busy: boolean;
  reviewStarting: boolean;
  start: () => Promise<void>;
  cancel: () => Promise<void>;
};

/** The progress section collapses away once the review finishes, rather than vanishing. */
export default function ReviewProgress(props: ReviewProgressProps) {
  return <Reveal className="game-progress-reveal">{progressSection(props)}</Reveal>;
}

function progressSection({
  game,
  running,
  busy,
  reviewStarting,
  start,
  cancel,
}: ReviewProgressProps) {
  const refining = game.job?.phase === "refinement";
  // The session keeps polling background refinement; interruptions still expose recovery.
  if (!game.job?.error && (game.job?.status === "completed" || (refining && running))) return null;
  // A shared game shows where its owner's review stands, without owner controls.
  if (game.read_only)
    return (
      <section className="game-progress" aria-label="Review progress">
        <p role="status">
          {running && game.job
            ? `Review in progress: ${refining ? `${game.job.refinement_completed}/${game.job.refinement_total} ${pluralWord(game.job.refinement_total, "position")} investigated` : `${game.job.completed}/${game.job.total} ${pluralWord(game.job.total, "move")} reviewed`}`
            : "This game's review isn't finished yet."}
        </p>
      </section>
    );
  return (
    <section className="game-progress" aria-label="Review progress">
      {game.job?.status !== "completed" && (
        <>
          <div className="row-between">
            <span>
              {refining && game.job
                ? `${game.job.refinement_completed}/${game.job.refinement_total} ${pluralWord(game.job.refinement_total, "position")} investigated`
                : game.job
                  ? `${game.job.completed}/${game.job.total} ${pluralWord(game.job.total, "move")} reviewed`
                  : `${plural(game.frames.length - 1, "move")} to review`}
            </span>
            {running ? (
              <Button size="compact" disabled={busy || game.job?.cancel_requested} onClick={cancel}>
                Pause review
              </Button>
            ) : (
              <Button
                size="compact"
                variant="primary"
                disabled={busy || reviewStarting}
                onClick={start}
              >
                {reviewStarting
                  ? "Starting review…"
                  : !game.job || game.job.status === "failed"
                    ? "Retry review"
                    : "Resume review"}
              </Button>
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
                ? refining
                  ? "Pausing investigation…"
                  : "Finishing active moves…"
                : game.job?.status === "queued"
                  ? "Review queued. You can explore while you wait."
                  : refining
                    ? "Checking selected positions more deeply. Your review is ready to explore."
                    : "Reviewing both sides…"}
            </p>
          )}
        </>
      )}
      <Reveal>
        {game.job?.error && (
          <Notice announcement="alert" tone="error" appearance="inline" className="small">
            {game.job.error}
          </Notice>
        )}
      </Reveal>
    </section>
  );
}
