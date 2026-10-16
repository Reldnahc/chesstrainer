import type { LegalMove, Schema } from "../../api";
import type { LessonTopic } from "../../navigation";

// The editor edits the readable course file itself (docs/COURSE_FILES.md), so
// anything it does not show, such as source games, is kept unchanged.
export type Credit = { text: string; url?: string; license?: string };
export type Step = {
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
export type Chapter = {
  id: string;
  title: string;
  entry?: string;
  steps: Step[];
  [key: string]: unknown;
};
export type Line = {
  id: string;
  title: string;
  moves: string;
  repertoire?: boolean;
  eco?: string;
  fen?: string;
  position?: string;
  [key: string]: unknown;
};
export type Course = {
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
export type Kind =
  "explanation" | "demonstration" | "decision" | "branch" | "rehearsal" | "game_excerpt";
export type Check = Schema["CourseFileCheck"];
export type StepBoard = Schema["CourseFileStep"];
export type Recording = {
  field: "show" | "decision" | "position";
  fen: string;
  moves: string;
  legal: LegalMove[];
  turnFen: string;
};
/** Applies one edit to a copy of the course. */
export type Change = (update: (draft: Course) => void) => void;

export const KINDS: { value: Kind; label: string; help: string }[] = [
  { value: "explanation", label: "Explanation", help: "The learner reads the text and continues." },
  { value: "demonstration", label: "Demonstration", help: "The app plays moves on the board." },
  {
    value: "decision",
    label: "Decision",
    help: "The learner must find a move; the app answers with a reply.",
  },
  {
    value: "branch",
    label: "Side trip",
    help: "The learner may enter a side trip and return here.",
  },
  { value: "rehearsal", label: "Rehearsal", help: "The learner plays a whole line from memory." },
  { value: "game_excerpt", label: "Game excerpt", help: "Plays part of a source game." },
];
export const KIND_FIELDS = [
  "show",
  "move",
  "reply",
  "feedback",
  "hint",
  "choices",
  "branch",
  "game",
  "from",
  "to",
  "rehearse",
];
// Emptying one of these keeps it as "", so the step keeps its kind while being written.
export const KIND_DEFINING = new Set(["show", "move", "rehearse", "branch", "game"]);

export function kindOf(step: Step): Kind {
  if (step.show !== undefined) return "demonstration";
  if (step.move !== undefined || step.choices !== undefined) return "decision";
  if (step.branch !== undefined) return "branch";
  if (step.game !== undefined) return "game_excerpt";
  if (step.rehearse !== undefined) return "rehearsal";
  return "explanation";
}

export function newCourse(): Course {
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
    chapters: [
      {
        id: "chapter-1",
        title: "Chapter 1",
        steps: [{ id: "introduction", title: "Introduction", text: "" }],
      },
    ],
  };
}

export function uniqueId(base: string, taken: string[]) {
  let id = base;
  for (let index = 2; taken.includes(id); index++) id = `${base}-${index}`;
  return id;
}

export function words(value: string) {
  return value
    .split(/[\s,]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

/** Renames a step and every link to it in its chapter: `next`, a side trip's start,
 * each choice's `next` and the chapter's entry. Run when the id is committed, so a
 * name typed on the way never re-points another step's links. */
export function renameStep(chapter: Chapter, index: number, id: string) {
  const previous = chapter.steps[index].id;
  for (const item of chapter.steps) {
    if (item.next === previous) item.next = id;
    if (item.branch === previous) item.branch = id;
    for (const choice of item.choices ?? []) if (choice.next === previous) choice.next = id;
  }
  if (chapter.entry === previous) chapter.entry = id;
  chapter.steps[index].id = id;
}

/** Why an id cannot be used, or null: it must be set and not name another item. */
export function idProblem(id: string, taken: string[], label: string) {
  if (!id.trim()) return `A ${label} needs an id.`;
  if (taken.includes(id)) return `Another ${label} already uses the id ${id}.`;
  return null;
}

/** Deletes a step, and every link to it then carries on to the next step in the
 * list (a side trip or the chapter's entry is cleared), so nothing names a step
 * that no longer exists. */
export function removeStep(chapter: Chapter, index: number) {
  const gone = chapter.steps[index].id;
  chapter.steps.splice(index, 1);
  for (const item of chapter.steps) {
    if (item.next === gone) delete item.next;
    if (item.branch === gone) item.branch = "";
    for (const choice of item.choices ?? []) if (choice.next === gone) delete choice.next;
  }
  if (chapter.entry === gone) delete chapter.entry;
}

/** Deletes a line; rehearsal steps that replayed it are left asking for a line. */
export function removeLine(course: Course, index: number) {
  const gone = course.lines![index].id;
  course.lines!.splice(index, 1);
  for (const chapter of course.chapters)
    for (const step of chapter.steps) if (step.rehearse === gone) step.rehearse = "";
}

/** Renames a line and every rehearsal step, in any chapter, that replays it. */
export function renameLine(course: Course, index: number, id: string) {
  const previous = course.lines![index].id;
  for (const chapter of course.chapters)
    for (const step of chapter.steps) if (step.rehearse === previous) step.rehearse = id;
  course.lines![index].id = id;
}

/** Whether the live check's problem is in this step, from its structured location. */
export function hasProblem(check: Check | null, chapterId: string, stepId: string) {
  return !!check?.error && check.location?.chapter === chapterId && check.location.step === stepId;
}
