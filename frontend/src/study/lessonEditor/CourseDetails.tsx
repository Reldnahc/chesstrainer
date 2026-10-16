import ChoiceGroup from "../../ChoiceGroup";
import Field from "./Field";
import type { Change, Course } from "./model";

/** The course's own fields: title, id, description, side, Study section and credit. */
export default function CourseDetails({ course, change, opened }: { course: Course; change: Change; opened: boolean }) {
  return <details className="disclosure lesson-editor-section" open={!opened}>
    <summary>Course details</summary>
    <div className="lesson-editor-fields">
      <Field label="Title"><input value={course.title} onChange={event => change(draft => { draft.title = event.target.value; })} /></Field>
      <Field label="Course id" help="Lowercase letters, digits and hyphens. Saving under a new id makes a separate course."><input value={course.id} onChange={event => change(draft => { draft.id = event.target.value; })} /></Field>
      <Field label="Description"><textarea rows={3} value={course.description ?? ""} onChange={event => change(draft => { draft.description = event.target.value; })} /></Field>
      <Field group label="The learner plays"><ChoiceGroup label="The learner plays" value={course.side} onChange={side => change(draft => { draft.side = side; })} options={[{ value: "white", label: "White" }, { value: "black", label: "Black" }]} /></Field>
      <Field group label="Study section"><ChoiceGroup label="Study section" value={course.topic ?? "opening"} onChange={topic => change(draft => { draft.topic = topic; })} options={[{ value: "opening", label: "Openings" }, { value: "skills", label: "Fundamentals" }]} /></Field>
      <Field label="Credit" help="Who wrote the course, shown under its chapters."><input value={course.credits[0]?.text ?? ""} onChange={event => change(draft => { draft.credits[0] = { ...draft.credits[0], text: event.target.value }; })} /></Field>
      <p className="small muted">Revision {course.revision}. Saving changed content gives the course a new revision, so members keep the version they started.</p>
    </div>
  </details>;
}
