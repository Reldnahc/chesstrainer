import {useId} from "react";
import {Info, X} from "lucide-react";
import {humanInsightLabels, humanSourceNotes} from "../dialogue/humanClaims";
import {makeIntent, type DialogueIntent} from "../dialogue/model";
import {useDialogue} from "../dialogue/useDialogue";
import DialogueText from "../dialogue/DialogueText";
import type {Report} from "./types";

export default function HumanInsight({intent, report}: {intent: DialogueIntent; report: Report}) {
  const id = useId();
  const items = intent.claims.filter(item => humanInsightLabels[item.code]).sort((a, b) => b.priority - a.priority);
  const utterance = useDialogue(makeIntent(`${intent.id}:human`, intent.purpose, intent.mode,
    intent.expression, items, intent.decisions, intent.subject));
  if (!items.length) return null;
  const label = humanInsightLabels[items[0].code], {name, notes} = humanSourceNotes(report);
  return <>
    <button className="human-insight-trigger" popoverTarget={id} aria-label={`${name}: ${label}`}>
      <span><b>{name}</b> · {label}</span><Info size={13} aria-hidden="true" />
    </button>
    <div className="human-insight-popover" id={id} popover="auto" role="dialog" aria-labelledby={`${id}-title`}>
      <header>
        <h3 id={`${id}-title`}>{name} insight</h3>
        <button popoverTarget={id} popoverTargetAction="hide" aria-label="Close insight"><X size={18} aria-hidden="true" /></button>
      </header>
      <strong>{label}</strong>
      <DialogueText utterance={utterance} />
      <div className="human-insight-source">{notes.map(note => <p key={note}>{note}</p>)}</div>
    </div>
  </>;
}
