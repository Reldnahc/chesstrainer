import { ArrowRight, BookOpen } from "lucide-react";
import ReviewCoach from "../ReviewCoach";
import Button from "../Button";
import MoveStatus from "../MoveStatus";
import RecallReceipt from "./RecallReceipt";
import type { CoachExpression } from "../coach/model";
import type { ReviewSession } from "./useReviewSession";
import { useCoachSpeech } from "../audio/speech/useCoachSpeech";
import { openingRecallRecording } from "../audio/speech/practiceSelection";

/** Curated recall has repertoire authority, never an objective move grade. */
export default function OpeningRecallPanel({ session }: { session: ReviewSession }) {
  const { position, feedback, busy, gradingError, hadFailure, next, show } = session;
  const recordingId = openingRecallRecording({position, feedback, failed: !!position?.failed || hadFailure, error: !!gradingError});
  const voice = useCoachSpeech({
    scopeKey: `opening-recall:${position?.session_id}:${feedback?.attempt_id ?? session.feedbackEventId ?? "cold"}:${recordingId}`,
    recordingId, ready: !!position?.opening && !busy && !session.loading,
    automaticEventId: gradingError ? null : !feedback ? session.openEventId
      : feedback.grade !== "revealed" ? session.feedbackEventId : null,
  });
  if (!position?.opening) return null;
  const opening = feedback?.opening ?? position.opening;
  const completed = !!feedback?.completed;
  const failed = position.failed || hadFailure;
  const unscheduled = feedback?.non_scheduling_reason ?? position.non_scheduling_reason;
  const receipt = unscheduled
    ? { message: <>{unscheduled}{feedback?.scheduling_status === "previously_recorded" ? " Your earlier recall remains recorded." : ""}</> }
    : completed && feedback.retired
      ? { message: "Recall saved. This position is retired until its study material changes." }
      : completed && feedback.next_due
        ? {
          message: <>Recall saved.{(failed || feedback.grade === "revealed")
            && " Your first attempt stays marked for relearning."}</>,
          nextDue: feedback.next_due,
        }
        : {};
  const expression: CoachExpression = gradingError ? "uncertain" : busy ? "thinking"
    : feedback?.grade === "revealed" ? "explaining"
    : completed ? failed ? "recovered" : "good"
    : failed ? "encouraging" : "neutral";
  const title = gradingError ? "Let’s try that again."
    : completed ? feedback.grade === "revealed" ? "Studied move revealed." : "Opening recalled."
    : failed ? "Try your studied move." : opening.prompt;
  const message = gradingError ? "Your move could not be saved. Try again."
    : completed ? feedback.grade === "revealed" ? "Here is your studied continuation." : "This matches your selected study material."
    : feedback?.message || (failed ? "Play a move from the study lines you selected."
      : opening.names.length > 1 ? "Any continuation from these selected lines is accepted."
      : "Recall a move from your selected study material.");
  return <div className="practice-panel opening-recall-panel">
    <ReviewCoach title={<h2>{title}</h2>} voice={voice}
      reaction={{ state: expression, key: `${position.session_id}:${feedback?.attempt_id ?? "cold"}:${expression}` }}
      portraitCaption={<span>{opening.color === "white" ? "White" : "Black"} repertoire</span>}
      actions={completed
        ? <Button size="compact" variant="primary" disabled={busy} onClick={next}>Next position <ArrowRight size={17} /></Button>
        : <Button size="compact" variant="secondary" disabled={busy} onClick={show}>Reveal move</Button>}
    >
      <p className="opening-recall-names"><BookOpen size={14} aria-hidden="true" /> <strong>{opening.names.join(" · ")}</strong></p>
      <MoveStatus busy={busy} failed={failed && !completed} text={message} />
    </ReviewCoach>
    <RecallReceipt {...receipt} />
    {completed && <section className="opening-recall-answers" aria-label="Studied continuations">
      <h3>Studied {feedback.answers?.length === 1 ? "move" : "moves"}</h3>
      <p className="review-move">{feedback.answers?.map(answer => answer.san).join(" · ")}</p>
      {feedback.continuations?.map((line, index) => <div className="opening-recall-line" key={`${line.study_id}:${index}`}>
        <h4>{line.name}</h4>
        <p>{line.moves.map(frame => {
          const fields = frame.before_fen.split(" ");
          return `${fields[5]}${fields[1] === "w" ? "." : "…"} ${frame.san}`;
        }).join(" ")}</p>
      </div>)}
    </section>}
  </div>;
}
