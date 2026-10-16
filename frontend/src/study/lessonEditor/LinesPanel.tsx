import { Plus, Trash2 } from "lucide-react";
import Button from "../../Button";
import Field, { CommittedInput } from "./Field";
import { renameLine, uniqueId, type Change, type Course, type StepBoard } from "./model";

/** The course's lines to remember: what rehearsal steps replay and members can add to Due. */
export default function LinesPanel({ course, board, change }: { course: Course; board: StepBoard | undefined; change: Change }) {
  return <details className="disclosure lesson-editor-section">
    <summary>Lines to remember ({course.lines?.length ?? 0})</summary>
    <p className="small muted">Rehearsal steps replay these lines, and members can add them to Due.</p>
    {(course.lines ?? []).map((line, index) => <div className="lesson-editor-fields lesson-editor-line" key={index}>
      <Field label="Line title"><input value={line.title} onChange={event => change(draft => { draft.lines![index].title = event.target.value; })} /></Field>
      {/* Rehearsal steps follow a renamed line once the id is committed. */}
      <Field label="Line id" help="Rehearsal steps link to this name.">
        <CommittedInput key={`${index}:${line.id}`} value={line.id} onCommit={id => change(draft => renameLine(draft, index, id))} />
      </Field>
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
  </details>;
}
