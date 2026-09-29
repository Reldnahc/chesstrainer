import type { Promotion } from "./api";
import Board from "./Board";
import { LoadingState } from "./LoadState";
import ReviewWorkspace from "./ReviewWorkspace";
import ReviewPanel from "./srsReview/ReviewPanel";
import { useReviewSession } from "./srsReview/useReviewSession";
import { useReviewPlayback } from "./srsReview/useReviewPlayback";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default function ReviewScreen({
  requested,
  requestedSession,
  focusSkill,
  fail,
  onEvidence,
}: {
  requested: string | null;
  requestedSession?: string | null;
  focusSkill: string | null;
  fail: (e: unknown) => void;
  onEvidence: (id: string) => void;
}) {
  const session = useReviewSession({ requested, requestedSession, focusSkill, fail });
  const playback = useReviewPlayback(session.feedback);
  const { position, due, loading, busy, feedback, submittedMove, done } =
    session;
  const { explaining, explanationFrame, preview, previewFrame, mistakeCue } =
    playback;
  function answer(from: string, to: string, promotion?: Promotion) {
    if (preview || explaining) return;
    playback.beginAttempt();
    return session.answer(from, to, promotion);
  }
  const moveUci = feedback?.reveal_frame?.uci || submittedMove;
  // Training acceptance is not a full-game engine rating. Only show confirmed
  // feedback, and only on the board position containing that attempted move.
  const feedbackLabel =
    feedback?.grade === "revealed"
      ? "Revealed"
      : feedback?.completed
        ? "Accepted"
        : feedback || position?.failed
          ? "Retry"
          : null;
  const quality =
    !explaining &&
    !busy &&
    moveUci &&
    feedbackLabel &&
    (feedback?.completed || preview === "attempt")
      ? {
          square: moveUci.slice(2, 4),
          label: feedbackLabel,
          accessibleLabel: `Move feedback: ${feedbackLabel}`,
        }
      : undefined;
  const heading = (
    <>
      <h1>Your move.</h1>
      {focusSkill && <span className="sr-only">FOCUSED PRACTICE</span>}
      <span className="review-session-count">
        <b>{done}</b>{" "}
        <span>
          {focusSkill ? "practiced this session" : "reviewed this session"}
        </span>
      </span>
    </>
  );
  return (
    <>
      {loading ? (
        <>
          <div className="review-workspace-heading">{heading}</div>
          <LoadingState presentation="panel">Loading your practice…</LoadingState>
        </>
      ) : (
        <div className="review-session">
          <ReviewWorkspace
            heading={heading}
            boardLabel="Chess position"
            aboveBoard={
              <div className="review-position-status">
                <span>
                  <span
                    className={`turn-dot ${position?.fen.split(" ")[1] === "b" ? "black" : ""}`}
                  />
                  {explaining
                    ? "Line playback"
                    : preview
                      ? preview === "attempt"
                        ? "Your attempted move"
                        : "Opponent reply"
                      : feedback?.completed
                        ? feedback.grade === "revealed"
                          ? "Answer shown"
                          : "Move played"
                        : position
                          ? (position.fen.split(" ")[1] === "w"
                              ? "White"
                              : "Black") + " to move"
                          : "Your next move starts here"}
                </span>
                <span>
                  {position
                    ? `${due} IN QUEUE`
                    : "NO POSITION LOADED"}
                </span>
              </div>
            }
            belowBoard={
              <div className="review-board-hint">
                {position
                  ? "Select a piece to see legal moves. Tap a destination or drag."
                  : "Import a game to turn real decisions into useful practice."}
              </div>
            }
            board={
              <Board
                key={position?.session_id || "empty"}
                fen={
                  explanationFrame?.fen ||
                  previewFrame?.fen ||
                  (feedback?.completed && feedback.fen
                    ? feedback.fen
                    : position?.fen || START)
                }
                roles={explanationFrame?.roles}
                quality={quality}
                feedback={mistakeCue && !explaining ? "retry" : undefined}
                highlights={
                  explanationFrame?.highlights ||
                  previewFrame?.highlights ||
                  feedback?.reveal_frame?.highlights ||
                  (feedback?.completed && moveUci
                    ? [moveUci.slice(0, 2), moveUci.slice(2, 4)]
                    : [])
                }
                orientation={position?.orientation || "white"}
                legalMoves={position?.legal_moves}
                disabled={
                  !position ||
                  busy ||
                  feedback?.completed ||
                  !!preview ||
                  explaining
                }
                onMove={answer}
              />
            }
          >
            <ReviewPanel
              session={session}
              playback={playback}
              feedbackLabel={feedbackLabel}
              focusSkill={focusSkill}
              onEvidence={onEvidence}
            />
          </ReviewWorkspace>
        </div>
      )}
    </>
  );
}
