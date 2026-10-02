import {useId} from "react";
import {ExternalLink, Info, X} from "lucide-react";
import {humanInsightExplanation, humanInsightLabels, humanSourceNotes, type HumanInsightPresentation} from "../dialogue/humanClaims";
import DialogueText from "../dialogue/DialogueText";
import {IconButton} from "../Button";
import type {Report} from "./types";

// The popover is silent: the move's single coach playback in the bubble already
// voices the Maia reading (see selectGameSpeech).
export default function HumanInsight({presentation, report}: {
  presentation: HumanInsightPresentation;
  report: Report;
}) {
  const id = useId();
  const {intent, utterance} = presentation, items = intent.claims;
  if (!items.length) return null;
  const label = humanInsightLabels[items[0].code], {name, note, url} = humanSourceNotes(report);
  return <>
    <button className="human-insight-trigger" popoverTarget={id} aria-label={`${name}: ${label}`}>
      <span><b>{name}</b> · {label}</span><Info size={13} aria-hidden="true" />
    </button>
    <div className="human-insight-popover" id={id} popover="auto" role="dialog" aria-labelledby={`${id}-title`}>
      <header>
        <h3 id={`${id}-title`}>{name} insight</h3>
        <IconButton size="compact" variant="quiet" popoverTarget={id} popoverTargetAction="hide" aria-label="Close insight"><X size={18} aria-hidden="true" /></IconButton>
      </header>
      <DialogueText utterance={utterance} />
      <p className="human-insight-meaning">{humanInsightExplanation(items[0].code, report)}</p>
      <div className="human-insight-source">
        <span>{note}</span>
        {url && <a href={url} target="_blank" rel="noopener noreferrer">About Maia<ExternalLink size={12} aria-hidden="true" /></a>}
      </div>
    </div>
  </>;
}
