import { ArrowRight, ShieldCheck } from "lucide-react";
import MoveStatus from "../MoveStatus";
import MoveBadge from "../MoveBadge";
import ReviewCoach from "../ReviewCoach";
import ReviewExplanation from "../ReviewExplanation";
import ReviewDetails from "./ReviewDetails";
import type { ReviewSession } from "./useReviewSession";
import type { ReviewPlayback } from "./useReviewPlayback";
import { practiceReaction } from "../coach/reactions";
import { practiceIntent } from "../dialogue/practiceIntent";
import { claim, makeIntent } from "../dialogue/model";
import { useDialogue } from "../dialogue/useDialogue";
import DialogueText from "../dialogue/DialogueText";

export default function ReviewPanel({
  session,
  playback,
  feedbackLabel,
  focusSkill,
  onExitFocus,
  onImport,
  onEvidence,
}: {
  session: ReviewSession;
  playback: ReviewPlayback;
  feedbackLabel: string | null;
  focusSkill: string | null;
  onExitFocus: () => void;
  onImport: () => void;
  onEvidence: (id: string) => void;
}) {
  const { position, feedback, busy, done, next, show } = session;
  const {
    practicePanel,
    explaining,
    explanationMinHeight,
    setExplanationFrame,
    closeExplanation,
    mistakeCue,
    preview,
    previewFrame,
    retry,
    explanationOpener,
    openExplanation,
  } = playback;
  const reaction = position ? practiceReaction({position, feedback, busy, mistake: mistakeCue,
    hadFailure: session.hadFailure, error: !!session.gradingError}) : {key: "practice-empty", state: "neutral" as const};
  const utterance = useDialogue(position ? practiceIntent({position, feedback, frame: previewFrame,
    hadFailure: session.hadFailure, expression: reaction.state, error: !!session.gradingError})
    : makeIntent("practice-empty", "neutral", "practice", "neutral", [claim("cold")]));
  return (
    <div
      ref={practicePanel}
      className="practice-panel"
      style={explaining ? { minHeight: explanationMinHeight } : undefined}
    >
      {explaining && position ? (
        <ReviewExplanation
          sessionId={position.session_id}
          attemptId={feedback?.attempt_id || position.last_attempt_id}
          solution={feedback?.grade === "revealed"}
          completed={!!feedback?.completed}
          initialPly={feedback?.counter_reply ? 2 : 1}
          onFrame={setExplanationFrame}
          onClose={closeExplanation}
        />
      ) : !position ? (
        <>
          <span className="section-number">GET STARTED</span>
          <h2>
            {focusSkill
              ? "Practice complete."
              : done
                ? "You’re caught up."
                : "Train from your games."}
          </h2>
          <p>
            {focusSkill
              ? "Your practice is saved separately. Review schedules and retirement progress are unchanged."
              : done
                ? "Your next reviews are scheduled. Come back when they’re due, or add another game."
                : "Bring in a PGN. We’ll look for decisions worth practicing and keep the useful positions here."}
          </p>
          <button
            className="primary"
            onClick={focusSkill ? onExitFocus : onImport}
          >
            {focusSkill ? "Return to mixed review" : "Import games"}{" "}
            <ArrowRight size={17} />
          </button>
          <div className="aside-note">
            <ShieldCheck size={19} />
            <p>
              Practice useful decisions from your own games, with feedback
              grounded in saved chess analysis.
            </p>
          </div>
        </>
      ) : (
        <>
          <ReviewCoach
            reaction={reaction}
            title={
              <h2>
                {feedback?.completed
                  ? feedback.retired
                    ? "Position retired."
                    : feedback.grade === "revealed"
                      ? "Move revealed."
                      : "Good decision."
                  : mistakeCue
                    ? "Mistake."
                    : "Find a good move."}
              </h2>
            }
            badge={
              !busy && feedbackLabel ? (
                <MoveBadge label={feedbackLabel} />
              ) : undefined
            }
            actions={
              <div className="review-actions">
                {feedback?.completed ? (
                  <button
                    className="primary review-action"
                    disabled={busy}
                    onClick={next}
                  >
                    Next position <ArrowRight size={17} />
                  </button>
                ) : preview ? (
                  <button className="primary review-action" onClick={retry}>
                    Try again
                  </button>
                ) : (
                  <button
                    className="secondary review-action"
                    disabled={busy}
                    onClick={show}
                  >
                    Reveal move
                  </button>
                )}
                <button
                  ref={explanationOpener}
                  className="secondary review-why"
                  disabled={busy || !(feedback || position.last_attempt_id)}
                  onClick={openExplanation}
                >
                  {feedback?.completed ? "Show why" : "Show me why"}
                </button>
              </div>
            }
          >
            {session.gradingError ? (
              <DialogueText utterance={utterance} />
            ) : feedback?.completed ? (
              <div role="status" aria-live="polite" aria-atomic="true">
                <p>
                  <strong className="review-move">
                    {feedback.submitted_san ||
                      feedback.answers
                        ?.filter((a) => a.primary)
                        .map((a) => a.san)
                        .join(", ")}
                  </strong>
                </p>
                <DialogueText utterance={utterance} />
              </div>
            ) : previewFrame ? (
              <div role="status" aria-live="polite" aria-atomic="true">
                <DialogueText utterance={utterance} />
              </div>
            ) : (
              <MoveStatus
                busy={busy}
                text={utterance.text}
                failed={position.failed || !!(feedback && !feedback.completed)}
              />
            )}
          </ReviewCoach>
          <div className="review-schedule">
            {feedback?.completed && feedback.retired ? (
              <p className="review-due" role="status">
                Progress saved. Retired from future reviews.
              </p>
            ) : feedback?.completed && feedback.next_due ? (
              <p className="review-due" role="status">
                Progress saved. Next review:{" "}
                <time
                  dateTime={feedback.next_due}
                  title={new Date(feedback.next_due).toLocaleString()}
                >
                  {relativeDue(feedback.next_due)}
                </time>
                .
              </p>
            ) : null}
          </div>
          {focusSkill && (
            <>
              <p className="small practice-note">
                Focused practice. Your review schedule is unchanged.
              </p>
              <button className="text-button" onClick={onExitFocus}>
                Return to mixed review
              </button>
            </>
          )}
          <ReviewDetails
            position={position}
            feedback={feedback}
            focusSkill={focusSkill}
            onEvidence={onEvidence}
          />
        </>
      )}
    </div>
  );
}
function relativeDue(value: string) {
  const seconds = Math.max(0, (new Date(value).getTime() - Date.now()) / 1000);
  if (seconds < 60) return "in less than a minute";
  const formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: "always",
  });
  if (seconds < 3600)
    return formatter.format(Math.round(seconds / 60), "minute");
  if (seconds < 86400)
    return formatter.format(Math.round(seconds / 3600), "hour");
  return formatter.format(Math.round(seconds / 86400), "day");
}
