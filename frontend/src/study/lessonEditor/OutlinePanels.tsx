import { ArrowDown, ArrowUp, Circle, Plus, Trash2 } from "lucide-react";
import Button from "../../Button";
import ChoiceGroup from "../../ChoiceGroup";
import Field from "./Field";
import { KINDS, hasProblem, kindOf, type Chapter, type Check, type Course } from "./model";

type Reorder = { add: () => void; move: (offset: number) => void; remove: () => void };

/** The chapter picker, the selected chapter's title and id, and adding, moving and deleting chapters. */
export function ChapterPanel({ course, chapter, index, select, editChapter, reorder }: {
  course: Course;
  chapter: Chapter;
  index: number;
  select: (index: number) => void;
  editChapter: (update: (draft: Chapter) => void) => void;
  reorder: Reorder;
}) {
  return <section className="lesson-editor-section" aria-label="Chapters">
    <h2>Chapters</h2>
    <ChoiceGroup label="Chapter" value={index} onChange={select} options={course.chapters.map((item, position) => ({ value: position, label: `${position + 1}. ${item.title}` }))} />
    <div className="lesson-editor-fields">
      <Field label="Chapter title"><input value={chapter.title} onChange={event => editChapter(draft => { draft.title = event.target.value; })} /></Field>
      <Field label="Chapter id"><input value={chapter.id} onChange={event => editChapter(draft => { draft.id = event.target.value; })} /></Field>
    </div>
    <div className="button-row">
      <Button size="compact" variant="secondary" onClick={reorder.add}><Plus size={16} />Add chapter</Button>
      <Button size="compact" variant="quiet" disabled={index === 0} onClick={() => reorder.move(-1)}><ArrowUp size={16} />Earlier</Button>
      <Button size="compact" variant="quiet" disabled={index === course.chapters.length - 1} onClick={() => reorder.move(1)}><ArrowDown size={16} />Later</Button>
      <Button size="compact" variant="quiet" disabled={course.chapters.length === 1} onClick={reorder.remove}><Trash2 size={16} />Delete chapter</Button>
    </div>
  </section>;
}

/** The chapter's steps, each marked when the live check's problem is in it, and adding, moving and deleting steps. */
export function StepList({ chapter, index, check, select, reorder }: {
  chapter: Chapter;
  index: number;
  check: Check | null;
  select: (index: number) => void;
  reorder: Reorder;
}) {
  return <section className="lesson-editor-section" aria-label="Steps">
    <h2>Steps</h2>
    <ol className="lesson-editor-steps">{chapter.steps.map((item, position) => <li key={`${position}:${item.id}`}>
      <button type="button" aria-current={position === index ? "step" : undefined} onClick={() => select(position)}>
        <span className="lesson-editor-step-kind">{KINDS.find(option => option.value === kindOf(item))?.label}</span>
        <span>{item.title || item.id}</span>
        {hasProblem(check, chapter.id, item.id) && <Circle size={10} role="img" aria-label="Has a problem" className="lesson-editor-problem" />}
      </button>
    </li>)}</ol>
    <div className="button-row">
      <Button size="compact" variant="secondary" onClick={reorder.add}><Plus size={16} />Add step after</Button>
      <Button size="compact" variant="quiet" disabled={index === 0} onClick={() => reorder.move(-1)}><ArrowUp size={16} />Earlier</Button>
      <Button size="compact" variant="quiet" disabled={index === chapter.steps.length - 1} onClick={() => reorder.move(1)}><ArrowDown size={16} />Later</Button>
      <Button size="compact" variant="quiet" disabled={chapter.steps.length === 1} onClick={reorder.remove}><Trash2 size={16} />Delete step</Button>
    </div>
  </section>;
}
