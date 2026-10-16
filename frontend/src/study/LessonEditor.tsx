import { useEffect, useMemo, useRef, useState } from "react";
import { usePageTitle } from "../PageTitle";
import Banner from "../Banner";
import { ArrowLeft, Save, Square } from "lucide-react";
import { errorMessage, api, read, type Promotion, type Schema } from "../api";
import ActionLink from "../ActionLink";
import Board from "../Board";
import Button from "../Button";
import ChoiceGroup from "../ChoiceGroup";
import { LoadingState } from "../LoadState";
import Notice from "../Notice";
import Reveal from "../Reveal";
import ReviewWorkspace from "../ReviewWorkspace";
import TurnIndicator from "../TurnIndicator";
import {
  courseEditorPath,
  courseSettingsPath,
  lessonCoursePath,
  replaceAddress,
  useLeaveGuard,
} from "../navigation";
import { sideName, sideToMove, START_FEN } from "../fen";
import { useLatest } from "../useLatest";
import { CommandError, QueryResult, useQuery, useCommand } from "../useQuery";
import { fetchCourseFile, saveCourseFile, savedMessage } from "./courseFiles";
import CourseDetails from "./lessonEditor/CourseDetails";
import LinesPanel from "./lessonEditor/LinesPanel";
import { ChapterPanel, StepList } from "./lessonEditor/OutlinePanels";
import StepPanel from "./lessonEditor/StepPanel";
import {
  KIND_DEFINING,
  KIND_FIELDS,
  idProblem,
  kindOf,
  newCourse,
  removeStep as unlinkStep,
  renameStep,
  uniqueId,
  type Chapter,
  type Check,
  type Course,
  type Kind,
  type Recording,
  type Step,
} from "./lessonEditor/model";

export default function LessonEditor({
  courseId,
  revision,
}: {
  courseId: string | null;
  revision: string | null;
}) {
  usePageTitle("Lesson editor");
  if (!courseId) return <CourseEditor initial={newCourse()} opened={false} />;
  return <SavedCourseEditor courseId={courseId} revision={revision} />;
}

/** A saved course's file, loaded once for the editor, with Try again when it fails. */
function SavedCourseEditor({ courseId, revision }: { courseId: string; revision: string | null }) {
  const query = useQuery(
    signal => fetchCourseFile(courseId, revision || undefined, signal) as Promise<Course>,
    [courseId, revision],
  );
  return (
    <QueryResult query={query} label="the course" presentation="panel">
      {file => <CourseEditor initial={file} opened />}
    </QueryResult>
  );
}

/** Edits one course: `opened` is a saved course's file, otherwise a new course. */
function CourseEditor({ initial, opened }: { initial: Course; opened: boolean }) {
  const [course, setCourse] = useState<Course | null>(initial);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [check, setCheck] = useState<Check | null>(null);
  const [checking, setChecking] = useState(false);
  // The check request itself failed (not a problem in the course); Try again re-runs it.
  const [checkError, setCheckError] = useState("");
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [dirty, setDirty] = useState(!opened);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  // This screen's failures: fail(e) reports, the shared banner shows them.
  const errors = useCommand();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [showEnd, setShowEnd] = useState(false);
  const [saved, setSaved] = useState<Schema["CourseFileSaved"] | null>(null);
  // The revision the editor opened (null for a new course), so a save never
  // replaces someone else's newer save or an existing course by accident.
  const [base, setBase] = useState<string | null>(opened ? initial.revision : null);
  const [pending, setPending] = useState(false);
  const edits = useRef(0);
  const recordingRef = useLatest(recording);
  // Bumped when recording starts or stops, so a late answer cannot restart it.
  const recordingRequest = useRef(0);

  // Check the whole file shortly after each change; the server owns every chess rule.
  useEffect(() => {
    if (!course) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a server check starts here; the editor shows it pending until it answers
    setChecking(true);
    const timer = window.setTimeout(() => {
      read(api.POST("/api/study/course-files/check", { body: course, signal: controller.signal }))
        .then(result => {
          if (!controller.signal.aborted) {
            setCheck(result);
            setCheckError("");
            setChecking(false);
          }
        })
        .catch(e => {
          if (controller.signal.aborted) return;
          // Keep the last good check, so the board stays while the server is unreachable.
          setCheckError(errorMessage(e));
          setChecking(false);
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [course, checkAttempt]);

  useLeaveGuard(dirty, "Leave the lesson editor? Your unsaved changes will be lost.");

  const chapter = course?.chapters[Math.min(chapterIndex, (course?.chapters.length ?? 1) - 1)];
  const step = chapter?.steps[Math.min(stepIndex, chapter.steps.length - 1)];
  const stepKey = chapter && step ? `${chapter.id}/${step.id}` : "";
  const board = check?.steps[stepKey];
  const otherSteps = useMemo(
    () => chapter?.steps.filter(item => item !== step) ?? [],
    [chapter, step],
  );

  if (!course || !chapter || !step)
    return <LoadingState presentation="panel">Loading the course…</LoadingState>;
  const current: Course = course;
  const kind = kindOf(step);

  function change(update: (draft: Course) => void) {
    setCourse(previous => {
      if (!previous) return previous;
      const draft = structuredClone(previous);
      update(draft);
      return draft;
    });
    edits.current += 1;
    setDirty(true);
    errors.dismiss();
    setNotice("");
    setSaved(null);
  }
  const editChapter = (update: (draft: Chapter) => void) =>
    change(draft => update(draft.chapters[chapterIndex]));
  const editStep = (update: (draft: Step) => void) =>
    editChapter(draft => update(draft.steps[stepIndex]));
  function setField(field: keyof Step, value: unknown) {
    editStep(draft => {
      if (value === "" && KIND_DEFINING.has(field as string)) draft[field] = "";
      else if (value === undefined || value === "") delete draft[field];
      else draft[field] = value;
    });
  }
  function setKind(next: Kind) {
    editStep(draft => {
      for (const field of KIND_FIELDS) delete draft[field];
      if (next === "demonstration") draft.show = "";
      if (next === "decision") draft.move = "";
      if (next === "branch") draft.branch = otherSteps[0]?.id ?? "";
      if (next === "rehearsal") draft.rehearse = current.lines?.[0]?.id ?? "";
      if (next === "game_excerpt")
        Object.assign(draft, { game: current.games?.[0]?.id ?? "", from: 0, to: 1 });
    });
    stopRecording();
  }
  function stopRecording() {
    recordingRequest.current += 1;
    setRecording(null);
  }
  function selectStep(index: number) {
    setStepIndex(index);
    stopRecording();
    setShowEnd(false);
  }
  function selectChapter(index: number) {
    setChapterIndex(index);
    selectStep(0);
  }
  function addStep() {
    editChapter(draft => {
      const id = uniqueId(
        "step",
        draft.steps.map(item => item.id),
      );
      draft.steps.splice(stepIndex + 1, 0, { id, title: "New step", text: "" });
    });
    selectStep(stepIndex + 1);
  }
  function moveStep(offset: number) {
    const target = stepIndex + offset;
    if (target < 0 || target >= chapter!.steps.length) return;
    editChapter(draft => {
      [draft.steps[stepIndex], draft.steps[target]] = [draft.steps[target], draft.steps[stepIndex]];
    });
    setStepIndex(target);
  }
  function removeStep() {
    if (chapter!.steps.length === 1) return;
    editChapter(draft => unlinkStep(draft, stepIndex));
    selectStep(Math.max(0, stepIndex - 1));
  }
  function addChapter() {
    change(draft => {
      const id = uniqueId(
        "chapter",
        draft.chapters.map(item => item.id),
      );
      draft.chapters.push({
        id,
        title: `Chapter ${draft.chapters.length + 1}`,
        steps: [{ id: "introduction", title: "Introduction", text: "" }],
      });
    });
    selectChapter(current.chapters.length);
  }
  function moveChapter(offset: number) {
    const target = chapterIndex + offset;
    if (target < 0 || target >= current.chapters.length) return;
    change(draft => {
      [draft.chapters[chapterIndex], draft.chapters[target]] = [
        draft.chapters[target],
        draft.chapters[chapterIndex],
      ];
    });
    setChapterIndex(target);
  }
  function removeChapter() {
    if (current.chapters.length === 1) return;
    change(draft => {
      draft.chapters.splice(chapterIndex, 1);
    });
    selectChapter(Math.max(0, chapterIndex - 1));
  }

  async function play(
    fen: string,
    moves: string,
    move?: { from_square: string; to_square: string; promotion?: Promotion },
  ) {
    return read(
      api.POST("/api/study/course-files/position", {
        body: { fen, moves, move: move ? { ...move, promotion: move.promotion ?? null } : null },
      }),
    );
  }
  async function record(field: Recording["field"]) {
    const request = ++recordingRequest.current;
    errors.dismiss();
    const fen = field === "position" ? step!.fen || START_FEN : board?.fen;
    if (!fen) {
      errors.setError("Fix the problem above first, so this step has a board to start from.");
      return;
    }
    try {
      const result = await play(fen, "");
      // Another step was selected, or recording stopped, while the server answered.
      if (recordingRequest.current !== request) return;
      setRecording({ field, fen, moves: "", legal: result.legal_moves, turnFen: result.fen });
    } catch (e) {
      if (recordingRequest.current === request) errors.fail(e);
    }
  }
  async function recordMove(from: string, to: string, promotion?: Promotion) {
    const recording = recordingRef.current;
    if (!recording || pending) return;
    setPending(true);
    try {
      const result = await play(recording.fen, recording.moves, {
        from_square: from,
        to_square: to,
        promotion,
      });
      // Recording stopped or moved to another step while the server answered.
      if (recordingRef.current !== recording) return;
      const next = {
        ...recording,
        moves: result.moves,
        legal: result.legal_moves,
        turnFen: result.fen,
      };
      if (recording.field === "show") setField("show", result.moves);
      if (recording.field === "position") setField("position", result.moves);
      if (recording.field === "decision") {
        const [move, reply] = result.moves.split(" ");
        editStep(draft => {
          draft.move = move;
          if (reply) draft.reply = reply;
          else delete draft.reply;
        });
        // A decision is one move and at most one reply.
        if (reply) {
          setRecording(null);
          return;
        }
      }
      setRecording(next);
    } catch (e) {
      errors.fail(e);
    } finally {
      setPending(false);
    }
  }
  function startRecording(field: Recording["field"]) {
    if (field === "show") setField("show", "");
    if (field === "position") setField("position", "");
    if (field === "decision")
      editStep(draft => {
        draft.move = "";
        delete draft.reply;
      });
    void record(field);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    errors.dismiss();
    const sent = edits.current;
    try {
      const result = await saveCourseFile(
        current,
        base === null ? { create: true } : { base_revision: base },
      );
      setCourse(previous => previous && { ...previous, revision: result.revision });
      setBase(result.revision);
      // Edits made while the save was in flight are still unsaved.
      if (edits.current === sent) setDirty(false);
      setSaved(result);
      setNotice(savedMessage(result));
      // A reload opens what was saved, including a new course after its first save.
      replaceAddress(courseEditorPath(result.id, result.revision));
    } catch (e) {
      errors.fail(e);
    } finally {
      setSaving(false);
    }
  }

  const fen = recording ? recording.turnFen : showEnd ? board?.end_fen : board?.fen;
  const turn = sideToMove(fen ?? START_FEN);
  const arrows = (step.arrows ?? []).map(arrow => {
    const [startSquare, endSquare] = arrow.split("-");
    return { startSquare, endSquare, color: "#f5b56abb" };
  });
  const recordingLabel =
    recording &&
    {
      show: "Play the moves to demonstrate.",
      decision: "Play the learner's move, then the opponent's reply.",
      position: "Play the moves that lead to where this step starts.",
    }[recording.field];

  return (
    <ReviewWorkspace
      boardLabel="Lesson editor board"
      heading={
        <div className="lesson-editor-heading">
          <ActionLink size="compact" variant="quiet" href={courseSettingsPath}>
            <ArrowLeft size={16} />
            Courses
          </ActionLink>
          <h1>{current.title || "Untitled course"}</h1>
          <Button size="compact" variant="primary" disabled={saving} onClick={save}>
            <Save size={16} />
            {saving ? "Saving…" : dirty ? "Save course" : "Saved"}
          </Button>
        </div>
      }
      aboveBoard={
        <div className="review-position-status">
          <TurnIndicator color={turn}>
            {recording ? `Recording · ${sideName(turn)} to move` : `${sideName(turn)} to move`}
          </TurnIndicator>
          <span>{showEnd ? "WHERE THIS STEP ENDS" : "WHERE THIS STEP STARTS"}</span>
        </div>
      }
      belowBoard={
        <div className="review-board-hint">
          {recording
            ? recordingLabel
            : board
              ? board.position
                ? `Moves so far: ${board.position}`
                : "Starting position"
              : checking
                ? "Checking…"
                : "This step has no board until the problem above is fixed."}
        </div>
      }
      boardControls={
        <div className="lesson-board-controls">
          {recording ? (
            <Button size="compact" variant="secondary" onClick={stopRecording}>
              <Square size={16} />
              Stop recording
            </Button>
          ) : (
            <ChoiceGroup
              label="Board shows"
              value={showEnd ? "end" : "start"}
              onChange={value => setShowEnd(value === "end")}
              options={[
                { value: "start", label: "Step start" },
                { value: "end", label: "Step end" },
              ]}
            />
          )}
        </div>
      }
      board={
        <Board
          fen={fen ?? START_FEN}
          orientation={current.side}
          legalMoves={recording?.legal ?? []}
          disabled={!recording || pending}
          onMove={recordMove}
          highlights={step.squares ?? []}
          arrows={arrows}
        />
      }
    >
      <Reveal>
        {checking && !check ? (
          <Notice announcement="status">Checking the course…</Notice>
        ) : check?.error ? (
          <Notice announcement="status" tone="error">
            {check.error}
          </Notice>
        ) : (
          check && (
            <Notice announcement="status" tone="success">
              The course loads without problems.
            </Notice>
          )
        )}
      </Reveal>
      <CommandError
        command={{ error: checkError && `Couldn’t check the course: ${checkError}` }}
        action={
          <Button size="compact" onClick={() => setCheckAttempt(attempt => attempt + 1)}>
            Try again
          </Button>
        }
      />
      <CommandError command={errors} />
      {notice && (
        <Banner
          tone="success"
          onDismiss={() => setNotice("")}
          action={
            saved ? (
              <ActionLink
                size="compact"
                variant="secondary"
                href={lessonCoursePath(saved.id, saved.revision, current.topic ?? "opening")}
              >
                Open the course
              </ActionLink>
            ) : undefined
          }
        >
          {notice}
        </Banner>
      )}

      <CourseDetails course={current} change={change} opened={opened} />
      <ChapterPanel
        course={current}
        chapter={chapter}
        index={chapterIndex}
        select={selectChapter}
        editChapter={editChapter}
        renameChapter={id => {
          const problem = idProblem(
            id,
            current.chapters.filter(item => item !== chapter).map(item => item.id),
            "chapter",
          );
          if (problem) errors.setError(problem);
          else
            editChapter(draft => {
              draft.id = id;
            });
        }}
        reorder={{ add: addChapter, move: moveChapter, remove: removeChapter }}
      />
      <StepList
        chapter={chapter}
        index={stepIndex}
        check={check}
        select={selectStep}
        reorder={{ add: addStep, move: moveStep, remove: removeStep }}
      />
      <StepPanel
        course={current}
        step={step}
        number={stepIndex + 1}
        kind={kind}
        otherSteps={otherSteps}
        board={board}
        setKind={setKind}
        setField={setField}
        editStep={editStep}
        record={startRecording}
        rename={id => {
          const problem = idProblem(
            id,
            otherSteps.map(item => item.id),
            "step",
          );
          if (problem) errors.setError(problem);
          else editChapter(draft => renameStep(draft, stepIndex, id));
        }}
      />
      <LinesPanel course={current} board={board} change={change} refuse={errors.setError} />
    </ReviewWorkspace>
  );
}
