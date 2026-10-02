import type { ColdPosition, ExplanationFrame, Feedback, MoveExplanation, PatternFinding, Schema } from "../../api";

/** Only replay_line's explicit facts authorize a complete recorded frame description. */
export function explanationFrameRecording(frame: ExplanationFrame | null | undefined, index?: number): string | null {
  if (!frame || frame.facts_version !== 1) return null;
  if (!frame.uci) return index === 0 ? "explanation-frame-original" : null;
  const ending = frame.checkmate ? "mate" : frame.gives_check ? "check" : frame.escaped_check ? "escape" : "ordinary";
  if (frame.castling) {
    if (frame.capture || frame.promotion || frame.escaped_check) return null;
    return ending === "ordinary" ? "positional-castling-actual" : `explanation-frame-castle-${ending}`;
  }
  if (!frame.capture && !frame.promotion && ending === "mate") return "mate-finished";
  return `explanation-frame-${frame.capture ? "capture" : "quiet"}-${frame.promotion ? "promotion" : "move"}-${ending}`;
}

const summaryRecordings: Record<string, string | undefined> = {
  mate_for_mover: "srs-summary-mate-for-mover", mate_against_mover: "srs-summary-mate-against-mover",
  material_gain: "srs-summary-material-gain", material_loss: "srs-summary-material-loss",
  engine_accepted: "srs-summary-engine-accepted", engine_rejected: "srs-summary-engine-rejected",
  curated_accepted: "srs-summary-curated-accepted", curated_rejected: "srs-summary-curated-rejected",
};
function summaryRecording(kind: string | null | undefined, frame?: ExplanationFrame | null) {
  return kind === "frame" ? explanationFrameRecording(frame) : kind ? summaryRecordings[kind] ?? null : null;
}

export function practiceRecording({position, feedback, frame, error}: {
  position: ColdPosition | null; feedback: Feedback | null; frame?: ExplanationFrame | null; error?: boolean;
}): string | null {
  if (!position) return null;
  if (error) return "srs-practice-error";
  // A cold position cannot borrow future frames, stored findings or answer details.
  if (!feedback) return position.failed ? "srs-retry" : "srs-cold";
  if (frame?.annotation) return explanationFrameRecording(frame);
  if (!feedback.completed) return "srs-retry";
  if (feedback.explanation_summary)
    return summaryRecording(feedback.explanation_summary_kind, feedback.explanation_summary_frame);
  if (feedback.message) {
    if (feedback.grade === "revealed") return null;
    return feedback.message_kind === "good_move" ? "srs-fallback-good"
      : feedback.message_kind === "practice_saved" ? "srs-fallback-focus-saved"
      : feedback.message_kind === "relearning" ? "srs-fallback-relearning" : null;
  }
  return "srs-fallback-study";
}

export function explanationSummaryRecording(data: MoveExplanation): string | null {
  const kind = data.summary_kind;
  if (kind?.startsWith("engine_") && data.authority !== "stockfish") return null;
  if (kind?.startsWith("curated_") && data.authority !== "curated") return null;
  return summaryRecording(kind, data.summary_frame_index == null ? null : data.frames[data.summary_frame_index]);
}

const findingAliases: Record<string, string | undefined> = {
  fork_recognized: "tactic-fork-played", defender_captured: "tactic-removing-defender-played",
  deflection: "tactic-deflection-played", promotion: "tactic-promotion-awareness-played",
  undefended_capture: "tactic-undefended-capture-played", back_rank_mate: "tactic-back-rank-played",
  abandoned_defender: "cause-abandoned-defender", unfavorable_exchange: "cause-avoiding-bad-trades",
};
const findingMechanisms = new Set([
  "fork_collected", "pin_prevents_capture", "pin_restricts_escape", "pin_defenders_no_recapture", "pin_collected",
  "skewer_collected", "king_skewer_collected", "sole_defender_captured", "deflection_collected",
  "discovered_capture", "discovered_check", "double_check", "double_attack_collected",
  "promotion_material_retained", "undefended_capture_gain",
]);
const cueKeys = new Set(["hanging_piece", "missed_tactical_capture", "fork", "pin", "skewer", "removing_defender",
  "discovered_attack", "double_attack", "back_rank", "promotion_awareness", "abandoned_defender", "avoiding_bad_trades", "deflection"]);

function currentFinding(data: MoveExplanation, finding: PatternFinding | null | undefined, index: number): finding is PatternFinding {
  return !!finding && !!data.analysis_id && finding.analysis_id === data.analysis_id
    && !!data.findings?.includes(finding) && finding.frame_ply === index
    && data.frames[index]?.facts_version === 1 && finding.plies.length > 0
    && finding.plies.length === finding.moves.length
    && finding.plies.every((ply, i) => Number.isInteger(ply) && ply > 0 && data.frames[ply]?.uci === finding.moves[i]);
}
export function explanationFindingRecording(data: MoveExplanation, finding: PatternFinding | null | undefined, index: number): string | null {
  if (!currentFinding(data, finding, index) || !finding.mechanism) return null;
  return findingAliases[finding.mechanism] ?? (findingMechanisms.has(finding.mechanism)
    ? `explanation-finding-${finding.mechanism.replaceAll("_", "-")}` : null);
}
export function explanationCueRecording(data: MoveExplanation, finding: PatternFinding | null | undefined, index: number): string | null {
  if (!currentFinding(data, finding, index) || !finding.cue_key || finding.cue_key !== finding.skill_id || !cueKeys.has(finding.cue_key)) return null;
  return `explanation-cue-${finding.cue_key.replaceAll("_", "-")}`;
}
const noteKinds = new Set(["curated_authority", "strong_replies", "material_scope", "no_simple_reason", "saved_policy"]);
export function explanationNoteRecording(data: MoveExplanation, index: number): string | null {
  const kind = data.note_kinds?.[index];
  return data.notes[index] && kind && noteKinds.has(kind) ? `explanation-note-${kind.replaceAll("_", "-")}` : null;
}

export function openingRecallRecording({position, feedback, failed, error}: {
  position: ColdPosition | null; feedback: Feedback | null; failed: boolean; error: boolean;
}): string | null {
  if (!position?.opening) return null;
  if (error) return "srs-practice-error";
  if (feedback?.completed) return feedback.grade === "revealed" ? "opening-recall-revealed" : "opening-recall-accepted";
  if (feedback?.message) {
    return feedback.message_kind === "opening_rejected" ? "opening-recall-rejected"
      : feedback.message_kind === "opening_rejected_changed" ? "opening-recall-rejected-changed"
      : feedback.message_kind === "opening_rejected_retired" ? "opening-recall-rejected-retired" : null;
  }
  if (failed) return "opening-recall-retry-fallback";
  return (feedback?.opening ?? position.opening).names.length > 1 ? "opening-recall-cold-multiple" : "opening-recall-cold-single";
}

export function puzzleRecording({session, error, playing, retrying}: {
  session: Schema["PuzzleSessionView"] | null; error: boolean; playing: boolean; retrying: boolean;
}): string | null {
  if (!session) return null;
  if (error) return "puzzle-error";
  if (playing) return "puzzle-playback";
  if (session.status === "revealed") return "puzzle-revealed";
  if (session.status === "solved") return session.failed ? "puzzle-solved-after-retry" : "puzzle-solved-clean";
  if (session.status !== "active") return null;
  if (retrying) return "puzzle-rejected";
  return session.feedback?.grade === "correct" ? "puzzle-next-move" : "puzzle-cold";
}

type LessonSessionView = Schema["LessonSessionView"];
type LessonCommand = Schema["LessonCommand"]["action"];

/** One recording per lesson command response, chosen from the command and its
 * result. Generic framing only: authored step text, hints and notes stay written. */
export function lessonRecording({action, before, after}: {
  action: LessonCommand; before: LessonSessionView; after: LessonSessionView;
}): string | null {
  if (before.status !== "completed" && after.status === "completed" && action !== "show_move") return "lesson-chapter-complete";
  if (action === "move") return after.feedback?.kind === "incorrect" ? "lesson-wrong-move"
    : after.feedback?.kind === "correct" ? "lesson-correct-move" : null;
  if (action === "show_move") return after.feedback?.kind === "revealed" ? "lesson-move-revealed" : null;
  if (action === "enter_branch") return after.branch ? "lesson-branch-entered" : null;
  if (action === "open_game") return after.game ? "lesson-game-opened" : null;
  if (after.game || after.status === "completed") return null;
  if (after.playback.length) return action === "continue" ? "lesson-guided-playback" : null;
  return after.step.kind === "rehearsal" && after.actions.includes("move")
    && ["continue", "back", "return_branch", "close_game"].includes(action) ? "lesson-rehearsal-prompt" : null;
}
