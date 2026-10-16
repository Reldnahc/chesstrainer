import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** One labelled control; a group of buttons is named by its own aria-label instead.
 * Help text describes the field's own control through aria-describedby. */
export default function Field({ label, help, action, group, children }: { label: string; help?: string; action?: ReactNode; group?: boolean; children: ReactNode }) {
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

/** A text field whose value is committed when it is left or Enter is pressed, for
 * ids other parts of the course link to, so a name typed on the way never counts.
 * Key it by what it edits, so a draft never carries over to another item. */
export function CommittedInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  function commit() {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  }
  return <input value={draft ?? value} onChange={event => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={event => { if (event.key === "Enter") commit(); }} />;
}
