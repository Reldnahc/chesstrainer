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
import OpeningRecallPanel from "./OpeningRecallPanel";
import ActionLink from "../ActionLink";
import Button from "../Button";
import { pagePaths, studyPaths } from "../navigation";

type ReviewPanelProps = {
  session: ReviewSession;
  playback: ReviewPlayback;
  feedbackLabel: string | null;
  focusSkill: string | null;
  onEvidence: (id: string) => void;
};

export default function ReviewPanel(props: ReviewPanelProps) {
  return props.session.position?.opening
    ? <OpeningRecallPanel session={props.session} />
    : <GameRecallPanel {...props} />;
}

function GameRecallPanel({
  session,
  playback,
  feedbackLabel,
  focusSkill,
  onEvidence,
}: ReviewPanelProps) {
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
                : "Build your study queue."}
          </h2>
          <p>
            {focusSkill
              ? "Your practice is saved separately. Review schedules and retirement progress are unchanged."
              : done
                ? "Your next reviews are scheduled. Come back when they’re due, or add more study material."
                : "Choose opening lines to remember, or import games to practice decisions from your own play."}
          </p>
          {!focusSkill && <ActionLink variant="primary" href={studyPaths.openings}>Study openings <ArrowRight size={17} /></ActionLink>}
          <ActionLink
            variant={focusSkill ? "primary" : "secondary"}
            href={focusSkill ? studyPaths.due : pagePaths.Settings}
          >
            {focusSkill ? "Return to mixed review" : "Import games"}{" "}
            <ArrowRight size={17} />
          </ActionLink>
          <div className="aside-note">
            <ShieldCheck size={19} />
            <p>
              {focusSkill ? "Practice useful decisions from your own games, with feedback grounded in saved chess analysis."
                : "Due combines your selected opening recall with useful decisions from your games."}
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
              <>
                {feedback?.completed ? (
                  <Button
                    size="compact"
                    variant="primary"
                    disabled={busy}
                    onClick={next}
                  >
                    Next position <ArrowRight size={17} />
                  </Button>
                ) : preview ? (
                  <Button size="compact" variant="primary" onClick={retry}>
                    Try again
                  </Button>
                ) : (
                  <Button
                    size="compact"
                    variant="secondary"
                    disabled={busy}
                    onClick={show}
                  >
                    Reveal move
                  </Button>
                )}
                <Button
                  size="compact"
                  ref={explanationOpener}
                  variant="secondary"
                  disabled={busy || !(feedback || position.last_attempt_id)}
                  onClick={openExplanation}
                >
                  {feedback?.completed ? "Show why" : "Show me why"}
                </Button>
              </>
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
                Progress saved.{" "}
                {(position.failed || session.hadFailure || feedback.grade === "revealed") && "This recall stays marked for relearning. "}
                Next review:{" "}
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
              <ActionLink variant="quiet" href={studyPaths.due}>
                Return to mixed review
              </ActionLink>
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
