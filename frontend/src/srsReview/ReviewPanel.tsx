import { useState } from "react";
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
import RecallReceipt from "./RecallReceipt";
import ActionLink from "../ActionLink";
import Button from "../Button";
import { pagePaths, studyPaths } from "../navigation";
import { useCoachSpeech } from "../audio/speech/useCoachSpeech";
import { practiceRecording } from "../audio/speech/practiceSelection";
import { useSelectedCoachSpokenText } from "../audio/speech/spokenText";

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
  const [dismissedSpeechEvent, setDismissedSpeechEvent] = useState<string | null>(null);
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
  const recordingId = practiceRecording({position, feedback, frame: previewFrame, error: !!session.gradingError});
  // Generic one-sentence states show the coach's spoken line. A frame annotation
  // or explanation summary names concrete moves and material the spoken line
  // leaves out, so those stay written.
  const spoken = useSelectedCoachSpokenText(session.gradingError || !feedback
    || recordingId?.startsWith("srs-fallback-") ? recordingId : null);
  const shown = spoken ? {...utterance, text: spoken, speechText: spoken} : utterance;
  const voice = useCoachSpeech({
    scopeKey: `practice:${position?.session_id}:${feedback?.attempt_id ?? "cold"}:${preview ?? "position"}:${previewFrame?.fen ?? ""}:${recordingId}`,
    recordingId,
    ready: !!position && !busy && !session.loading && !explaining,
    // Counter-reply previews settle before speaking one primary description.
    automaticEventId: session.gradingError ? null
      : !feedback ? session.openEventId
      : feedback.grade !== "revealed"
      && session.feedbackEventId !== dismissedSpeechEvent
      && (feedback.completed || preview === "reply" || !feedback.counter_reply)
      ? session.feedbackEventId : null,
  });
  const receipt = feedback?.completed && feedback.retired
    ? { message: "Progress saved. Retired from future reviews." }
    : feedback?.completed && feedback.next_due
      ? {
        message: <>Progress saved.{(position?.failed || session.hadFailure || feedback.grade === "revealed")
          && " This recall stays marked for relearning."}</>,
        nextDue: feedback.next_due,
      }
      : {};
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
            voice={voice}
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
                  <Button size="compact" variant="primary" onClick={() => {
                    setDismissedSpeechEvent(session.feedbackEventId);
                    voice.stop();
                    retry();
                  }}>
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
                  onClick={() => {
                    setDismissedSpeechEvent(session.feedbackEventId);
                    voice.stop();
                    openExplanation();
                  }}
                >
                  {feedback?.completed ? "Show why" : "Show me why"}
                </Button>
              </>
            }
          >
            {session.gradingError ? (
              <DialogueText utterance={shown} />
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
                <DialogueText utterance={shown} />
              </div>
            ) : previewFrame ? (
              <div role="status" aria-live="polite" aria-atomic="true">
                <DialogueText utterance={shown} />
              </div>
            ) : (
              <MoveStatus
                busy={busy}
                text={shown.text}
                failed={position.failed || !!(feedback && !feedback.completed)}
              />
            )}
          </ReviewCoach>
          <RecallReceipt {...receipt} />
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
