import { ChevronRight, CircleCheck } from "lucide-react";
import Button from "../Button";
import type { ColdPosition, Feedback } from "../api";

export default function ReviewDetails({
  position,
  feedback,
  focusSkill,
  onEvidence,
}: {
  position: ColdPosition;
  feedback: Feedback | null;
  focusSkill: string | null;
  onEvidence: (id: string) => void;
}) {
  return (
    <details
      className="disclosure review-details"
      key={`${position.session_id}-${!!feedback?.completed}`}
    >
      <summary>
        {feedback?.completed ? "Answer & review details" : "Review details"}
      </summary>
      {feedback?.completed ? (
        <>
          <div className="answer-feedback">
            <CircleCheck size={20} />
            <div>
              <span>
                Accepted move
                {feedback.answers && feedback.answers.length > 1 ? "s" : ""}:{" "}
                {feedback.answers?.map((a) => a.san).join(", ")}
              </span>
            </div>
          </div>
          {feedback.explanation && <p>{feedback.explanation}</p>}
          {feedback.played_san && (
            <p className="small">
              In your game: {feedback.played_san} / {feedback.source}
            </p>
          )}
          {feedback.retired && (
            <p className="small">
              Your recall interval reached{" "}
              {Math.round(feedback.retired_interval_days || 0)} days. This
              position is permanently retired from reviews; your history is
              preserved.
            </p>
          )}
          {feedback.next_due && (
            <p className="small">
              Scheduled for {new Date(feedback.next_due).toLocaleString()}.
              Successful recalls build longer intervals. New positions can
              return within minutes while you learn them.
            </p>
          )}
          {feedback.decision_id && (
            <Button
              variant="quiet"
              onClick={() => onEvidence(feedback.decision_id!)}
            >
              See the evidence <ChevronRight size={16} />
            </Button>
          )}
        </>
      ) : (
        <>
          <p>Select a piece to see legal moves. Tap a destination or drag.</p>
          {position.previous_reviews > 0 && (
            <p>
              {
                {
                  resume:
                    "Resuming your unfinished attempt. Your earlier result is saved.",
                  learning:
                    "Learning review: this position is due again for a short follow-up. Your earlier result is saved.",
                  relearning:
                    "Relearning review: this position is due again after a missed recall.",
                  review:
                    "Scheduled review: time to recall this position again.",
                  practice:
                    "Extra practice: you opened this position before its scheduled review.",
                  new: "",
                }[position.review_reason]
              }
            </p>
          )}
        </>
      )}
      <p className="small muted">
        {focusSkill
          ? "Practice attempts are stored separately from scheduled recall."
          : "Due reviews come first."}{" "}
        A missed first attempt is recorded once; keep trying for as long as you
        need. FSRS spaces successful recalls farther apart. Positions retire
        permanently when their interval exceeds the retirement threshold in
        Settings.
      </p>
    </details>
  );
}
