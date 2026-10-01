import { useEffect, useId, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import Button from "../../Button";
import Notice from "../../Notice";
import type { CastingChoice as SavedChoice, CastingChoices } from "./useCastingChoices";

export function castingChoiceLabel(choice: SavedChoice | undefined, directions: readonly {id: string; label: string}[]) {
  if (!choice) return "Not decided yet";
  if (choice.stale) return choice.status === "keep-looking" ? "New auditions — ready for your review" : "Recording changed — review this choice";
  if (choice.status === "keep-looking") return "Keep looking — none of these fit";
  return `Chosen: ${directions.find(item => item.id === choice.directionId)?.label ?? "Unavailable direction"}`;
}

export default function CastingChoice({coachId, coachName, direction, directions, available, setAvailable, choices}: {
  coachId: string; coachName: string; direction: {id: string; label: string};
  directions: readonly {id: string; label: string}[]; available: boolean; setAvailable: boolean; choices: CastingChoices;
}) {
  const id = useId();
  const choice = choices.choices[coachId];
  const lock = choices.locks[coachId];
  const [note, setNote] = useState(choice?.note ?? "");
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setNote(choice?.note ?? "");
  }, [choice?.revision, choice?.note, dirty]);
  const saving = choices.savingCoach === coachId;
  const disabled = !choices.ready || !!choices.savingCoach;
  const selected = choice?.status === "selected" && !choice.stale && choice.directionId === direction.id;
  async function save(status: "selected" | "keep-looking") {
    if (await choices.write(coachId, status === "selected" ? {status, directionId: direction.id, note} : {status, note}))
      setDirty(false);
  }
  async function reset() {
    if (await choices.write(coachId, null)) {setNote(""); setDirty(false);}
  }
  if (lock) return <section className="casting-choice" aria-labelledby={`${id}-heading`}>
    <div className="casting-choice-heading"><h3 id={`${id}-heading`}>Your choice for {coachName}</h3></div>
    <p className="casting-choice-status" role="status">Locked: {lock.label}</p>
    <p className="cast-audition-note">This voice is saved for {coachName}. Its dialogue bank has not been recorded yet.</p>
    {lock.stale && <Notice appearance="inline" tone="error" announcement="alert">
      {lock.staleReason ?? "The locked recording is unavailable. Its saved voice remains locked."}
    </Notice>}
  </section>;
  return <section className="casting-choice" aria-labelledby={`${id}-heading`}>
    <div className="casting-choice-heading">
      <h3 id={`${id}-heading`}>Your choice for {coachName}</h3>
      {choice && <Button variant="quiet" size="compact" disabled={disabled} onClick={() => void reset()}>
        <RotateCcw size={13} aria-hidden="true" />Clear choice
      </Button>}
    </div>
    <p className="casting-choice-status" role="status" aria-live="polite">
      {saving ? "Saving to the studio…" : choices.ready ? castingChoiceLabel(choice, directions) : "Loading saved choices…"}
    </p>
    <label htmlFor={`${id}-note`}>Note <span>(optional)</span></label>
    <textarea id={`${id}-note`} rows={2} maxLength={2000} value={note} disabled={disabled}
      placeholder="What fits, or what should change?"
      onChange={event => {setNote(event.target.value); setDirty(true);}} />
    <div className="casting-choice-actions">
      <Button variant="primary" disabled={disabled || !available || selected && !dirty} onClick={() => void save("selected")}>
        {selected && <Check size={15} aria-hidden="true" />}{selected ? dirty ? "Save note" : "Voice chosen" : "Choose this voice"}
      </Button>
      <Button disabled={disabled || !setAvailable || choice?.status === "keep-looking" && !choice.stale && !dirty} onClick={() => void save("keep-looking")}>
        Keep looking
      </Button>
    </div>
    {choices.saveError?.coachId === coachId && <Notice appearance="inline" tone="error" announcement="alert">
      {choices.saveError.message}
      <Button size="compact" onClick={() => void choices.reload()}>Reload saved choices</Button>
    </Notice>}
  </section>;
}
