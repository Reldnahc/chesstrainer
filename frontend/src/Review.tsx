import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  CircleCheck,
  ShieldCheck,
} from "lucide-react";
import {
  api,
  post,
  type ExplanationFrame,
  type ColdPosition,
  type Feedback,
} from "./api";
import Board from "./Board";
import MoveStatus from "./MoveStatus";
import ReviewExplanation from "./ReviewExplanation";
import PageTitle from "./PageTitle";
import { clearExerciseLink } from "./navigation";
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export default function ReviewScreen({
  requested,
  focusSkill,
  onExitFocus,
  onImport,
  fail,
  onEvidence,
}: {
  focusSkill: string | null;
  onExitFocus: () => void;
  requested: string | null;
  onImport: () => void;
  fail: (e: unknown) => void;
  onEvidence: (id: string) => void;
}) {
  const [position, setPosition] = useState<ColdPosition | null>(null);
  const [due, setDue] = useState(0);
  const practiceBatch = useRef<
    | {
        exercise_id: string;
      }[]
    | null
  >(null);
  const practiced = useRef(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [done, setDone] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [mistakeCue, setMistakeCue] = useState(false);
  const [explanationFrame, setExplanationFrame] =
    useState<ExplanationFrame | null>(null);
  const explanationOpener = useRef<HTMLButtonElement | null>(null);
  const closeExplanation = useCallback(() => {
    setExplaining(false);
    setExplanationFrame(null);
    setMistakeCue(false);
    if (!feedback?.completed) {
      window.clearTimeout(previewTimer.current);
      setPreview(null);
    }
    window.requestAnimationFrame(() =>
      explanationOpener.current?.focus({ preventScroll: true }),
    );
  }, [feedback?.completed]);
  const [preview, setPreview] = useState<"attempt" | "reply" | null>(null);
  const previewTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(previewTimer.current);
    if (feedback?.counter_reply && !feedback.completed) {
      setPreview("attempt");
      previewTimer.current = window.setTimeout(() => setPreview("reply"), 400);
    } else setPreview(null);
    return () => window.clearTimeout(previewTimer.current);
  }, [feedback]);
  function retry() {
    setMistakeCue(false);
    window.clearTimeout(previewTimer.current);
    setPreview(null);
  }
  const previewFrame =
    preview === "attempt"
      ? feedback?.attempt_frame
      : preview === "reply"
        ? feedback?.counter_reply
        : undefined;
  const load = useCallback(
    async (id?: string | null, previous?: string | null) => {
      setLoading(true);
      setFeedback(null);
      setExplaining(false);
      setExplanationFrame(null);
      setMistakeCue(false);
      if (window.matchMedia("(max-width: 760px)").matches)
        window.scrollTo({ top: 0, behavior: "instant" });
      try {
        if (focusSkill && !practiceBatch.current)
          practiceBatch.current = await api(
            `/practice/queue?skill_id=${encodeURIComponent(focusSkill)}`,
          );
        const queue = focusSkill
          ? (practiceBatch.current || []).filter(
              (item) => !practiced.current.has(item.exercise_id),
            )
          : await api<
              {
                exercise_id: string;
              }[]
            >(`/review/queue${previous ? `?last_id=${previous}` : ""}`);
        setDue(queue.length);
        const next = id || queue[0]?.exercise_id;
        setPosition(
          next
            ? await post<ColdPosition>(
                `/review/${next}/start${focusSkill ? `?focus_skill_id=${encodeURIComponent(focusSkill)}` : ""}`,
              )
            : null,
        );
      } catch (e) {
        fail(e);
      } finally {
        setLoading(false);
      }
    },
    [fail, focusSkill],
  );
  useEffect(() => {
    void load(requested);
  }, [load, requested]);
  async function answer(from: string, to: string, promotion?: string) {
    if (!position || busy || feedback?.completed || preview || explaining)
      return;
    setMistakeCue(false);
    setBusy(true);
    try {
      const result = await post<Feedback>(
        `/review/sessions/${position.session_id}/move`,
        { from_square: from, to_square: to, promotion: promotion || null },
      );
      setFeedback(result);
      setMistakeCue(!result.completed);
      if (result.completed) {
        practiced.current.add(position.exercise_id);
        clearExerciseLink();
        setDone((v) => v + 1);
        setLast(position.exercise_id);
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function show() {
    if (!position) return;
    setBusy(true);
    try {
      setFeedback(
        await post<Feedback>(`/review/sessions/${position.session_id}/reveal`),
      );
      setMistakeCue(false);
      practiced.current.add(position.exercise_id);
      clearExerciseLink();
      setLast(position.exercise_id);
      setDone((v) => v + 1);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow={focusSkill ? "FOCUSED PRACTICE" : "TRAINING / REVIEW"}
        title="Your move."
        description="Build better decisions, one position at a time."
      >
        <div className="session-count">
          <strong>{done}</strong>
          <span>
            {focusSkill ? "practiced this session" : "reviewed this session"}
          </span>
        </div>
      </PageTitle>
      {loading ? (
        <div className="panel loading">Loading your practice…</div>
      ) : (
        <div className={`review-layout${position ? " review-session" : ""}`}>
          <section
            className={`board-area${mistakeCue && !explaining ? " review-mistake" : ""}`}
            aria-label="Chess position"
          >
            <div className="board-topline">
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
                  ? `${Math.max(0, due - (feedback?.completed ? 1 : 0))}${due === 30 ? "+" : ""} IN QUEUE`
                  : "NO POSITION LOADED"}
              </span>
            </div>
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
              highlights={
                explanationFrame?.highlights ||
                previewFrame?.highlights ||
                feedback?.reveal_frame?.highlights
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
            <div className="board-caption">
              {position
                ? "Select a piece to see legal moves. Tap a destination or drag."
                : "Import a game to turn real decisions into useful practice."}
              <span className="board-coordinate-note">POSITION PRACTICE</span>
            </div>
          </section>
          <aside className="practice-panel">
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
                    Stockfish analyzes on your computer. Local classification
                    groups supported tactical patterns.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="review-result-heading">
                  <h2>
                    {feedback?.completed
                      ? feedback.retired
                        ? "Position retired."
                        : feedback.grade === "revealed"
                          ? "Move revealed."
                          : "Good decision."
                      : mistakeCue
                        ? "Mistake."
                        : preview
                          ? preview === "attempt"
                            ? "Your attempted move"
                            : "Opponent's best reply"
                          : "Find a good move."}
                  </h2>
                  {feedback?.completed && (
                    <strong className="review-move">
                      {feedback.submitted_san ||
                        feedback.answers
                          ?.filter((a) => a.primary)
                          .map((a) => a.san)
                          .join(", ")}
                    </strong>
                  )}
                </div>
                {feedback?.completed && (
                  <p className="review-message">
                    <span>
                      {feedback.message ||
                        "Study the move, then try the next position."}
                    </span>
                    {feedback.explanation_summary && (
                      <span
                        className="review-reason"
                        title={feedback.explanation_summary}
                      >
                        {feedback.explanation_summary}
                      </span>
                    )}
                  </p>
                )}
                {!feedback?.completed &&
                  (previewFrame ? (
                    <div
                      className="move-status counter-caption"
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      <span>
                        <strong>Mistake.</strong> {previewFrame.annotation}
                      </span>
                    </div>
                  ) : (
                    <MoveStatus
                      busy={busy}
                      failed={
                        position.failed || !!(feedback && !feedback.completed)
                      }
                    />
                  ))}
                {feedback?.completed && feedback.retired && (
                  <p className="review-due" role="status">
                    Progress saved. Retired from future reviews.
                  </p>
                )}
                {feedback?.completed && feedback.next_due && (
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
                )}
                <div className="review-actions">
                  {feedback?.completed ? (
                    <button
                      className="primary review-action"
                      disabled={busy}
                      onClick={() => load(null, last)}
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
                  {(feedback || position.last_attempt_id) && (
                    <button
                      ref={explanationOpener}
                      className="secondary review-why"
                      disabled={busy}
                      onClick={() => setExplaining(true)}
                    >
                      {feedback?.completed ? "Show why" : "Show me why"}
                    </button>
                  )}
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
                <details
                  className="review-details"
                  key={`${position.session_id}-${!!feedback?.completed}`}
                >
                  <summary>
                    {feedback?.completed
                      ? "Answer & review details"
                      : "Review details"}
                  </summary>
                  {feedback?.completed ? (
                    <>
                      <div className="answer-feedback">
                        <CircleCheck size={20} />
                        <div>
                          <span>
                            Accepted move
                            {feedback.answers && feedback.answers.length > 1
                              ? "s"
                              : ""}
                            : {feedback.answers?.map((a) => a.san).join(", ")}
                          </span>
                        </div>
                      </div>
                      {feedback.explanation && <p>{feedback.explanation}</p>}
                      {feedback.played_san && (
                        <p className="small">
                          In your game: {feedback.played_san} /{" "}
                          {feedback.source}
                        </p>
                      )}
                      {feedback.retired && (
                        <p className="small">
                          Your recall interval reached{" "}
                          {Math.round(feedback.retired_interval_days || 0)}{" "}
                          days. This position is permanently retired from
                          reviews; your history is preserved.
                        </p>
                      )}
                      {feedback.next_due && (
                        <p className="small">
                          Scheduled for{" "}
                          {new Date(feedback.next_due).toLocaleString()}.
                          Successful recalls build longer intervals. New
                          positions can return within minutes while you learn
                          them.
                        </p>
                      )}
                      {feedback.decision_id && (
                        <button
                          className="text-button"
                          onClick={() => onEvidence(feedback.decision_id!)}
                        >
                          See the evidence <ChevronRight size={16} />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <p>
                        Select a piece to see legal moves. Tap a destination or
                        drag.
                      </p>
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
                    A missed first attempt is recorded once; keep trying for as
                    long as you need. FSRS spaces successful recalls farther
                    apart. Positions retire permanently when their interval
                    exceeds the retirement threshold in Settings.
                  </p>
                </details>
              </>
            )}
          </aside>
        </div>
      )}
    </>
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
