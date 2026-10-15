import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { usePageTitle } from "../PageTitle";
import Banner from "../Banner";
import { ArrowDown, ArrowLeft, ArrowUp, Circle, Plus, Save, Square, Trash2 } from "lucide-react";
import { errorMessage, api, read, type LegalMove, type Promotion, type Schema } from "../api";
import ActionLink from "../ActionLink";
import Board from "../Board";
import Button from "../Button";
import ChoiceGroup from "../ChoiceGroup";
import { LoadingState, UnavailableState } from "../LoadState";
import Notice from "../Notice";
import Reveal from "../Reveal";
import ReviewWorkspace from "../ReviewWorkspace";
import TurnIndicator from "../TurnIndicator";
import { courseEditorPath, courseSettingsPath, lessonCoursePath, replaceAddress, useLeaveGuard, type LessonTopic } from "../navigation";
import { sideName, sideToMove, START_FEN } from "../fen";
import { useLatest } from "../useLatest";
import { fetchCourseFile, saveCourseFile, savedMessage } from "./courseFiles";

// The editor edits the readable course file itself (docs/COURSE_FILES.md), so
// anything it does not show, such as source games, is kept unchanged.
type Credit = { text: string; url?: string; license?: string };
type Step = {
  id: string;
  title: string;
  text?: string;
  fen?: string;
  position?: string;
  next?: string | null;
  show?: string;
  move?: string;
  reply?: string;
  feedback?: string;
  hint?: string;
  choices?: { move?: string; next?: string | null; [key: string]: unknown }[];
  branch?: string;
  game?: string;
  from?: number;
  to?: number;
  rehearse?: string;
  squares?: string[];
  arrows?: string[];
  [key: string]: unknown;
};
type Chapter = { id: string; title: string; entry?: string; steps: Step[]; [key: string]: unknown };
type Line = { id: string; title: string; moves: string; repertoire?: boolean; eco?: string; fen?: string; position?: string; [key: string]: unknown };
type Course = {
  format: string;
  id: string;
  revision: string;
  title: string;
  description?: string;
  side: "white" | "black";
  topic?: LessonTopic;
  credits: Credit[];
  lines?: Line[];
  games?: { id: string; title: string; [key: string]: unknown }[];
  chapters: Chapter[];
  [key: string]: unknown;
};
type Kind = "explanation" | "demonstration" | "decision" | "branch" | "rehearsal" | "game_excerpt";
type Check = Schema["CourseFileCheck"];
type Recording = { field: "show" | "decision" | "position"; fen: string; moves: string; legal: LegalMove[]; turnFen: string };

const KINDS: { value: Kind; label: string; help: string }[] = [
  { value: "explanation", label: "Explanation", help: "The learner reads the text and continues." },
  { value: "demonstration", label: "Demonstration", help: "The app plays moves on the board." },
  { value: "decision", label: "Decision", help: "The learner must find a move; the app answers with a reply." },
  { value: "branch", label: "Side trip", help: "The learner may enter a side trip and return here." },
  { value: "rehearsal", label: "Rehearsal", help: "The learner plays a whole line from memory." },
  { value: "game_excerpt", label: "Game excerpt", help: "Plays part of a source game." },
];
const KIND_FIELDS = ["show", "move", "reply", "feedback", "hint", "choices", "branch", "game", "from", "to", "rehearse"];
// Emptying one of these keeps it as "", so the step keeps its kind while being written.
const KIND_DEFINING = new Set(["show", "move", "rehearse", "branch", "game"]);
const FOLLOWING = "__following__";
const END = "__end__";

function kindOf(step: Step): Kind {
  if (step.show !== undefined) return "demonstration";
  if (step.move !== undefined || step.choices !== undefined) return "decision";
  if (step.branch !== undefined) return "branch";
  if (step.game !== undefined) return "game_excerpt";
  if (step.rehearse !== undefined) return "rehearsal";
  return "explanation";
}

function newCourse(): Course {
  return {
    format: "fieldwork-course-1",
    id: "new-course",
    revision: new Date().toLocaleDateString("sv"),
    title: "New course",
    description: "",
    side: "white",
    topic: "opening",
    credits: [{ text: "Written by our club." }],
    lines: [],
    chapters: [{ id: "chapter-1", title: "Chapter 1", steps: [{ id: "introduction", title: "Introduction", text: "" }] }],
  };
}

function uniqueId(base: string, taken: string[]) {
  let id = base;
  for (let index = 2; taken.includes(id); index++) id = `${base}-${index}`;
  return id;
}

function words(value: string) {
  return value.split(/[\s,]+/).map(item => item.trim()).filter(Boolean);
}

export default function LessonEditor({ courseId, revision }: { courseId: string | null; revision: string | null }) {
  const [course, setCourse] = useState<Course | null>(courseId ? null : newCourse);
  const [loadError, setLoadError] = useState("");
  const [chapterIndex, setChapterIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [check, setCheck] = useState<Check | null>(null);
  const [checking, setChecking] = useState(false);
  // The check request itself failed (not a problem in the course); Try again re-runs it.
  const [checkError, setCheckError] = useState("");
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [dirty, setDirty] = useState(!courseId);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [recording, setRecording] = useState<Recording | null>(null);
  const [showEnd, setShowEnd] = useState(false);
  const [saved, setSaved] = useState<Schema["CourseFileSaved"] | null>(null);
  // The revision the editor opened (null for a new course), so a save never
  // replaces someone else's newer save or an existing course by accident.
  const [base, setBase] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // The step id being typed; links to the step follow it once it is committed.
  const [stepId, setStepId] = useState<string | null>(null);
  const edits = useRef(0);
  const recordingRef = useLatest(recording);
  // Bumped when recording starts or stops, so a late answer cannot restart it.
  const recordingRequest = useRef(0);

  usePageTitle("Lesson editor");
  useEffect(() => {
    if (!courseId) return;
    const controller = new AbortController();
    fetchCourseFile(courseId, revision || undefined, controller.signal)
      .then(file => { if (!controller.signal.aborted) { setCourse(file as Course); setBase((file as Course).revision); } })
      .catch(e => { if (!controller.signal.aborted) setLoadError(errorMessage(e)); });
    return () => controller.abort();
  }, [courseId, revision]);

  // Check the whole file shortly after each change; the server owns every chess rule.
  useEffect(() => {
    if (!course) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a server check starts here; the editor shows it pending until it answers
    setChecking(true);
    const timer = window.setTimeout(() => {
      read(api.POST("/api/study/course-files/check", { body: course, signal: controller.signal }))
        .then(result => { if (!controller.signal.aborted) { setCheck(result); setCheckError(""); setChecking(false); } })
        .catch(e => {
          if (controller.signal.aborted) return;
          // Keep the last good check, so the board stays while the server is unreachable.
          setCheckError(errorMessage(e));
          setChecking(false);
        });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [course, checkAttempt]);

  useLeaveGuard(dirty, "Leave the lesson editor? Your unsaved changes will be lost.");

  const chapter = course?.chapters[Math.min(chapterIndex, (course?.chapters.length ?? 1) - 1)];
  const step = chapter?.steps[Math.min(stepIndex, chapter.steps.length - 1)];
  const stepKey = chapter && step ? `${chapter.id}/${step.id}` : "";
  const board = check?.steps[stepKey];
  const otherSteps = useMemo(() => chapter?.steps.filter(item => item !== step) ?? [], [chapter, step]);

  if (loadError) return <UnavailableState presentation="panel">{loadError}</UnavailableState>;
  if (!course || !chapter || !step) return <LoadingState presentation="panel">Loading the course…</LoadingState>;
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
    setError("");
    setNotice("");
    setSaved(null);
  }
  const editChapter = (update: (draft: Chapter) => void) => change(draft => update(draft.chapters[chapterIndex]));
  const editStep = (update: (draft: Step) => void) => editChapter(draft => update(draft.steps[stepIndex]));
  function setField(field: keyof Step, value: unknown) {
    editStep(draft => {
      if (value === "" && KIND_DEFINING.has(field as string)) draft[field] = "";
      else if (value === undefined || value === "") delete draft[field];
      else draft[field] = value;
    });
  }
  function renameStep(id: string) {
    const previous = step!.id;
    editChapter(draft => {
      for (const item of draft.steps) {
        if (item.next === previous) item.next = id;
        if (item.branch === previous) item.branch = id;
        for (const choice of item.choices ?? []) if (choice.next === previous) choice.next = id;
      }
      if (draft.entry === previous) draft.entry = id;
      draft.steps[stepIndex].id = id;
    });
  }
  function setKind(next: Kind) {
    editStep(draft => {
      for (const field of KIND_FIELDS) delete draft[field];
      if (next === "demonstration") draft.show = "";
      if (next === "decision") draft.move = "";
      if (next === "branch") draft.branch = otherSteps[0]?.id ?? "";
      if (next === "rehearsal") draft.rehearse = current.lines?.[0]?.id ?? "";
      if (next === "game_excerpt") Object.assign(draft, { game: current.games?.[0]?.id ?? "", from: 0, to: 1 });
    });
    stopRecording();
  }
  function commitStepId() {
    if (stepId !== null && stepId !== step!.id) renameStep(stepId);
    setStepId(null);
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
      const id = uniqueId("step", draft.steps.map(item => item.id));
      draft.steps.splice(stepIndex + 1, 0, { id, title: "New step", text: "" });
    });
    selectStep(stepIndex + 1);
  }
  function moveStep(offset: number) {
    const target = stepIndex + offset;
    if (target < 0 || target >= chapter!.steps.length) return;
    editChapter(draft => { [draft.steps[stepIndex], draft.steps[target]] = [draft.steps[target], draft.steps[stepIndex]]; });
    setStepIndex(target);
  }
  function removeStep() {
    if (chapter!.steps.length === 1) return;
    editChapter(draft => { draft.steps.splice(stepIndex, 1); });
    selectStep(Math.max(0, stepIndex - 1));
  }
  function addChapter() {
    change(draft => {
      const id = uniqueId("chapter", draft.chapters.map(item => item.id));
      draft.chapters.push({ id, title: `Chapter ${draft.chapters.length + 1}`, steps: [{ id: "introduction", title: "Introduction", text: "" }] });
    });
    selectChapter(current.chapters.length);
  }
  function moveChapter(offset: number) {
    const target = chapterIndex + offset;
    if (target < 0 || target >= current.chapters.length) return;
    change(draft => { [draft.chapters[chapterIndex], draft.chapters[target]] = [draft.chapters[target], draft.chapters[chapterIndex]]; });
    setChapterIndex(target);
  }
  function removeChapter() {
    if (current.chapters.length === 1) return;
    change(draft => { draft.chapters.splice(chapterIndex, 1); });
    selectChapter(Math.max(0, chapterIndex - 1));
  }

  async function play(fen: string, moves: string, move?: { from_square: string; to_square: string; promotion?: Promotion }) {
    return read(api.POST("/api/study/course-files/position", { body: { fen, moves, move: move ? { ...move, promotion: move.promotion ?? null } : null } }));
  }
  async function record(field: Recording["field"]) {
    const request = ++recordingRequest.current;
    setError("");
    const fen = field === "position" ? (step!.fen || START_FEN) : board?.fen;
    if (!fen) { setError("Fix the problem above first, so this step has a board to start from."); return; }
    try {
      const result = await play(fen, "");
      // Another step was selected, or recording stopped, while the server answered.
      if (recordingRequest.current !== request) return;
      setRecording({ field, fen, moves: "", legal: result.legal_moves, turnFen: result.fen });
    } catch (e) { if (recordingRequest.current === request) setError(errorMessage(e)); }
  }
  async function recordMove(from: string, to: string, promotion?: Promotion) {
    const recording = recordingRef.current;
    if (!recording || pending) return;
    setPending(true);
    try {
      const result = await play(recording.fen, recording.moves, { from_square: from, to_square: to, promotion });
      // Recording stopped or moved to another step while the server answered.
      if (recordingRef.current !== recording) return;
      const next = { ...recording, moves: result.moves, legal: result.legal_moves, turnFen: result.fen };
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
        if (reply) { setRecording(null); return; }
      }
      setRecording(next);
    } catch (e) { setError(errorMessage(e)); }
    finally { setPending(false); }
  }
  function startRecording(field: Recording["field"]) {
    if (field === "show") setField("show", "");
    if (field === "position") setField("position", "");
    if (field === "decision") editStep(draft => { draft.move = ""; delete draft.reply; });
    void record(field);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    const sent = edits.current;
    try {
      const result = await saveCourseFile(current, base === null ? { create: true } : { base_revision: base });
      setCourse(previous => previous && { ...previous, revision: result.revision });
      setBase(result.revision);
      // Edits made while the save was in flight are still unsaved.
      if (edits.current === sent) setDirty(false);
      setSaved(result);
      setNotice(savedMessage(result));
      // A reload opens what was saved, including a new course after its first save.
      replaceAddress(courseEditorPath(result.id, result.revision));
    } catch (e) { setError(errorMessage(e)); }
    finally { setSaving(false); }
  }

  const fen = recording ? recording.turnFen : showEnd ? board?.end_fen : board?.fen;
  const turn = sideToMove(fen ?? START_FEN);
  const nextValue = step.next === undefined ? FOLLOWING : step.next === null ? END : step.next;
  const arrows = (step.arrows ?? []).map(arrow => {
    const [startSquare, endSquare] = arrow.split("-");
    return { startSquare, endSquare, color: "#f5b56abb" };
  });
  const recordingLabel = recording && { show: "Play the moves to demonstrate.", decision: "Play the learner's move, then the opponent's reply.", position: "Play the moves that lead to where this step starts." }[recording.field];

  return <ReviewWorkspace
    boardLabel="Lesson editor board"
    heading={<div className="lesson-editor-heading">
      <ActionLink size="compact" variant="quiet" href={courseSettingsPath}><ArrowLeft size={16} />Courses</ActionLink>
      <h1>{current.title || "Untitled course"}</h1>
      <Button size="compact" variant="primary" disabled={saving} onClick={save}><Save size={16} />{saving ? "Saving…" : dirty ? "Save course" : "Saved"}</Button>
    </div>}
    aboveBoard={<div className="review-position-status"><TurnIndicator color={turn}>{recording ? `Recording · ${sideName(turn)} to move` : `${sideName(turn)} to move`}</TurnIndicator><span>{showEnd ? "WHERE THIS STEP ENDS" : "WHERE THIS STEP STARTS"}</span></div>}
    belowBoard={<div className="review-board-hint">{recording ? recordingLabel : board ? (board.position ? `Moves so far: ${board.position}` : "Starting position") : checking ? "Checking…" : "This step has no board until the problem above is fixed."}</div>}
    boardControls={<div className="lesson-board-controls">
      {recording ? <Button size="compact" variant="secondary" onClick={stopRecording}><Square size={16} />Stop recording</Button>
        : <ChoiceGroup label="Board shows" value={showEnd ? "end" : "start"} onChange={value => setShowEnd(value === "end")} options={[{ value: "start", label: "Step start" }, { value: "end", label: "Step end" }]} />}
    </div>}
    board={<Board fen={fen ?? START_FEN} orientation={current.side} legalMoves={recording?.legal ?? []} disabled={!recording || pending} onMove={recordMove} highlights={step.squares ?? []} arrows={arrows} />}
  >
    <Reveal>{checking && !check ? <Notice announcement="status">Checking the course…</Notice>
      : check?.error ? <Notice announcement="status" tone="error">{check.error}</Notice>
      : check && <Notice announcement="status" tone="success">The course loads without problems.</Notice>}</Reveal>
    {checkError && <Banner tone="error" action={<Button size="compact" onClick={() => setCheckAttempt(attempt => attempt + 1)}>Try again</Button>}>
      Couldn’t check the course: {checkError}
    </Banner>}
    {error && <Banner tone="error" onDismiss={() => setError("")}>{error}</Banner>}
    {notice && <Banner tone="success" onDismiss={() => setNotice("")} action={saved ? <ActionLink size="compact" variant="secondary" href={lessonCoursePath(saved.id, saved.revision, current.topic ?? "opening")}>Open the course</ActionLink> : undefined}>{notice}</Banner>}

    <details className="disclosure lesson-editor-section" open={!courseId}>
      <summary>Course details</summary>
      <div className="lesson-editor-fields">
        <Field label="Title"><input value={current.title} onChange={event => change(draft => { draft.title = event.target.value; })} /></Field>
        <Field label="Course id" help="Lowercase letters, digits and hyphens. Saving under a new id makes a separate course."><input value={current.id} onChange={event => change(draft => { draft.id = event.target.value; })} /></Field>
        <Field label="Description"><textarea rows={3} value={current.description ?? ""} onChange={event => change(draft => { draft.description = event.target.value; })} /></Field>
        <Field group label="The learner plays"><ChoiceGroup label="The learner plays" value={current.side} onChange={side => change(draft => { draft.side = side; })} options={[{ value: "white", label: "White" }, { value: "black", label: "Black" }]} /></Field>
        <Field group label="Study section"><ChoiceGroup label="Study section" value={current.topic ?? "opening"} onChange={topic => change(draft => { draft.topic = topic; })} options={[{ value: "opening", label: "Openings" }, { value: "skills", label: "Fundamentals" }]} /></Field>
        <Field label="Credit" help="Who wrote the course, shown under its chapters."><input value={current.credits[0]?.text ?? ""} onChange={event => change(draft => { draft.credits[0] = { ...draft.credits[0], text: event.target.value }; })} /></Field>
        <p className="small muted">Revision {current.revision}. Saving changed content gives the course a new revision, so members keep the version they started.</p>
      </div>
    </details>

    <section className="lesson-editor-section" aria-label="Chapters">
      <h2>Chapters</h2>
      <ChoiceGroup label="Chapter" value={chapterIndex} onChange={selectChapter} options={current.chapters.map((item, index) => ({ value: index, label: `${index + 1}. ${item.title}` }))} />
      <div className="lesson-editor-fields">
        <Field label="Chapter title"><input value={chapter.title} onChange={event => editChapter(draft => { draft.title = event.target.value; })} /></Field>
        <Field label="Chapter id"><input value={chapter.id} onChange={event => editChapter(draft => { draft.id = event.target.value; })} /></Field>
      </div>
      <div className="button-row">
        <Button size="compact" variant="secondary" onClick={addChapter}><Plus size={16} />Add chapter</Button>
        <Button size="compact" variant="quiet" disabled={chapterIndex === 0} onClick={() => moveChapter(-1)}><ArrowUp size={16} />Earlier</Button>
        <Button size="compact" variant="quiet" disabled={chapterIndex === current.chapters.length - 1} onClick={() => moveChapter(1)}><ArrowDown size={16} />Later</Button>
        <Button size="compact" variant="quiet" disabled={current.chapters.length === 1} onClick={removeChapter}><Trash2 size={16} />Delete chapter</Button>
      </div>
    </section>

    <section className="lesson-editor-section" aria-label="Steps">
      <h2>Steps</h2>
      <ol className="lesson-editor-steps">{chapter.steps.map((item, index) => <li key={`${index}:${item.id}`}>
        <button type="button" aria-current={index === stepIndex ? "step" : undefined} onClick={() => selectStep(index)}>
          <span className="lesson-editor-step-kind">{KINDS.find(option => option.value === kindOf(item))?.label}</span>
          <span>{item.title || item.id}</span>
          {problemStep(check?.error, chapter.id, item.id) && <Circle size={10} role="img" aria-label="Has a problem" className="lesson-editor-problem" />}
        </button>
      </li>)}</ol>
      <div className="button-row">
        <Button size="compact" variant="secondary" onClick={addStep}><Plus size={16} />Add step after</Button>
        <Button size="compact" variant="quiet" disabled={stepIndex === 0} onClick={() => moveStep(-1)}><ArrowUp size={16} />Earlier</Button>
        <Button size="compact" variant="quiet" disabled={stepIndex === chapter.steps.length - 1} onClick={() => moveStep(1)}><ArrowDown size={16} />Later</Button>
        <Button size="compact" variant="quiet" disabled={chapter.steps.length === 1} onClick={removeStep}><Trash2 size={16} />Delete step</Button>
      </div>
    </section>

    <section className="lesson-editor-section" aria-label="Selected step">
      <h2>Step {stepIndex + 1}: {step.title || step.id}</h2>
      <div className="lesson-editor-fields">
        <Field label="Kind" help={KINDS.find(option => option.value === kind)?.help}>
          <select value={kind} onChange={event => setKind(event.target.value as Kind)}>{KINDS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        </Field>
        <Field label="Title"><input value={step.title} onChange={event => setField("title", event.target.value)} /></Field>
        <Field label="Step id" help="Other steps link to this name.">
          <input value={stepId ?? step.id} onChange={event => setStepId(event.target.value)} onBlur={commitStepId}
            onKeyDown={event => { if (event.key === "Enter") commitStepId(); }} /></Field>
        <Field label="Text"><textarea rows={4} value={step.text ?? ""} onChange={event => setField("text", event.target.value)} /></Field>

        {/* Each kind's own fields grow in and collapse out as the kind changes. */}
        <Reveal>{kind === "demonstration" && <Field label="Moves to play" help="Ordinary notation, such as Nf3 Nc6."
          action={<Button size="compact" variant="secondary" onClick={() => startRecording("show")}><Circle size={16} />Record on the board</Button>}>
          <input value={step.show ?? ""} onChange={event => setField("show", event.target.value)} />
        </Field>}</Reveal>
        <Reveal>{kind === "decision" && (step.choices ? <Notice announcement="passive">This decision accepts several moves. Edit its choices in the course file.</Notice> : <div className="lesson-editor-fields">
          <Field label="Learner's move" action={<Button size="compact" variant="secondary" onClick={() => startRecording("decision")}><Circle size={16} />Record move and reply</Button>}>
            <input value={step.move ?? ""} onChange={event => setField("move", event.target.value)} /></Field>
          <Field label="Opponent's reply" help="Optional."><input value={step.reply ?? ""} onChange={event => setField("reply", event.target.value)} /></Field>
          <Field label="Hint" help="Shown when the learner asks for one."><input value={step.hint ?? ""} onChange={event => setField("hint", event.target.value)} /></Field>
          <Field label="Feedback" help="Shown after the right move."><input value={step.feedback ?? ""} onChange={event => setField("feedback", event.target.value)} /></Field>
        </div>)}</Reveal>
        <Reveal>{kind === "branch" && <Field label="Side trip starts at" help="The side trip's last step should end the chapter, so the learner returns here.">
          <select value={step.branch ?? ""} onChange={event => setField("branch", event.target.value)}><option value="">Choose a step</option>{otherSteps.map(item => <option key={item.id} value={item.id}>{item.title} ({item.id})</option>)}</select>
        </Field>}</Reveal>
        <Reveal>{kind === "rehearsal" && <Field label="Line to rehearse">
          <select value={step.rehearse ?? ""} onChange={event => setField("rehearse", event.target.value)}>
            <option value="">Choose a line</option>
            {(current.lines ?? []).map(line => <option key={line.id} value={line.id}>{line.title}</option>)}
          </select>
        </Field>}</Reveal>
        <Reveal>{kind === "game_excerpt" && <div className="lesson-editor-fields">
          <Field label="Source game"><select value={step.game ?? ""} onChange={event => setField("game", event.target.value)}><option value="">Choose a game</option>{(current.games ?? []).map(game => <option key={game.id} value={game.id}>{game.title}</option>)}</select></Field>
          <Field label="From ply"><input type="number" min={0} value={step.from ?? 0} onChange={event => setField("from", Number(event.target.value))} /></Field>
          <Field label="To ply"><input type="number" min={1} value={step.to ?? 1} onChange={event => setField("to", Number(event.target.value))} /></Field>
        </div>}</Reveal>

        <Field label="Then go to">
          <select value={nextValue} onChange={event => setField("next", event.target.value === FOLLOWING ? undefined : event.target.value === END ? null : event.target.value)}>
            <option value={FOLLOWING}>The next step in the list</option>
            <option value={END}>End the chapter (or return from a side trip)</option>
            {otherSteps.map(item => <option key={item.id} value={item.id}>{item.title} ({item.id})</option>)}
          </select>
        </Field>
        <Field group label="Starts from" help="Most steps carry on from the step before them.">
          <ChoiceGroup label="Starts from" value={step.position !== undefined || step.fen !== undefined ? "own" : "carry"} onChange={value => editStep(draft => {
            if (value === "own") {
              draft.position = board?.position ?? "";
              if (board && board.initial_fen !== START_FEN) draft.fen = board.initial_fen;
            }
            else { delete draft.position; delete draft.fen; }
          })} options={[{ value: "carry", label: "Carries on" }, { value: "own", label: "Its own position" }]} />
        </Field>
        <Reveal>{(step.position !== undefined || step.fen !== undefined) && <div className="lesson-editor-fields">
          <Field label="Moves from the start" action={<Button size="compact" variant="secondary" onClick={() => startRecording("position")}><Circle size={16} />Record on the board</Button>}>
            <input value={step.position ?? ""} onChange={event => setField("position", event.target.value)} /></Field>
          <Field label="Starting FEN" help="Optional, for an example that does not start from the initial position."><input value={step.fen ?? ""} onChange={event => setField("fen", event.target.value || undefined)} /></Field>
        </div>}</Reveal>
        <Field label="Highlighted squares" help="Such as e4 d5."><input value={(step.squares ?? []).join(" ")} onChange={event => setField("squares", words(event.target.value).length ? words(event.target.value) : undefined)} /></Field>
        <Field label="Arrows" help="Such as c3-d5 f1-b5."><input value={(step.arrows ?? []).join(" ")} onChange={event => setField("arrows", words(event.target.value).length ? words(event.target.value) : undefined)} /></Field>
      </div>
    </section>

    <details className="disclosure lesson-editor-section">
      <summary>Lines to remember ({current.lines?.length ?? 0})</summary>
      <p className="small muted">Rehearsal steps replay these lines, and members can add them to Due.</p>
      {(current.lines ?? []).map((line, index) => <div className="lesson-editor-fields lesson-editor-line" key={index}>
        <Field label="Line title"><input value={line.title} onChange={event => change(draft => { draft.lines![index].title = event.target.value; })} /></Field>
        <Field label="Line id"><input value={line.id} onChange={event => change(draft => { draft.lines![index].id = event.target.value; })} /></Field>
        <Field label="Moves" help="From the first move, ending on the learner's move."
          action={board && <Button size="compact" variant="secondary" onClick={() => change(draft => { draft.lines![index].moves = board.end_position; })}>Use the moves up to the selected step's end</Button>}>
          <input value={line.moves} onChange={event => change(draft => { draft.lines![index].moves = event.target.value; })} /></Field>
        <label className="check-row lesson-editor-check"><input type="checkbox" checked={!!line.repertoire} onChange={event => change(draft => { draft.lines![index].repertoire = event.target.checked || undefined; })} />Members can add it to Due</label>
        <Button size="compact" variant="quiet" onClick={() => change(draft => { draft.lines!.splice(index, 1); })}><Trash2 size={16} />Delete line</Button>
      </div>)}
      <Button size="compact" variant="secondary" onClick={() => change(draft => {
        draft.lines = draft.lines ?? [];
        draft.lines.push({ id: uniqueId("line", draft.lines.map(item => item.id)), title: "New line", moves: board?.end_position || "e4", repertoire: true });
      })}><Plus size={16} />Add line</Button>
    </details>
  </ReviewWorkspace>;
}

/** Whether the check's problem names this step: "Chapter <id>, step <id> ...". */
function problemStep(error: string | null | undefined, chapterId: string, stepId: string) {
  return !!error && error.includes(`Chapter ${chapterId}, step ${stepId}`)
    && !/[\w-]/.test(error.charAt(error.indexOf(`Chapter ${chapterId}, step ${stepId}`) + `Chapter ${chapterId}, step ${stepId}`.length));
}

/** One labelled control; a group of buttons is named by its own aria-label instead.
 * Help text describes the field's own control through aria-describedby. */
function Field({ label, help, action, group, children }: { label: string; help?: string; action?: ReactNode; group?: boolean; children: ReactNode }) {
  const helpId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const control = ref.current?.querySelector("input, select, textarea, [role=group]");
    if (!control) return;
    if (help) control.setAttribute("aria-describedby", helpId);
    else control.removeAttribute("aria-describedby");
  });
  return <div className="lesson-editor-field" ref={ref}>
    {group ? <><span className="lesson-editor-label">{label}</span>{children}</>
      : <label><span className="lesson-editor-label">{label}</span>{children}</label>}
    {action}
    {help && <span className="small muted" id={helpId}>{help}</span>}
  </div>;
}
