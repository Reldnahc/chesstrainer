import {useId, useState} from "react";
import {Info, X} from "lucide-react";
import {humanInsightExplanation, humanInsightIntent, humanInsightLabels, humanSourceNotes} from "../dialogue/humanClaims";
import type {DialogueIntent} from "../dialogue/model";
import {useDialogue} from "../dialogue/useDialogue";
import DialogueText from "../dialogue/DialogueText";
import {IconButton} from "../Button";
import type {Report} from "./types";
import {selectGameRecording, type GameSpeechContext} from "../audio/speech/gameSelection";
import {useCoachSpeech} from "../audio/speech/useCoachSpeech";
import CoachSpeechButton from "../audio/speech/CoachSpeechButton";

export default function HumanInsight({intent, report, speechContext, speechScopeKey, onManualSpeech}: {
  intent: DialogueIntent;
  report: Report;
  speechContext: Omit<GameSpeechContext, "intent" | "utterance" | "surface" | "claimIndex">;
  speechScopeKey: string;
  onManualSpeech?: () => void;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const spokenIntent = humanInsightIntent(intent), items = spokenIntent.claims;
  const utterance = useDialogue(spokenIntent);
  const recordingId = visible ? selectGameRecording({...speechContext, intent: spokenIntent,
    utterance, surface: "human-insight"}) : null;
  // Opening the insight never starts narration. A visible, explicit press owns
  // it; closing or replacing the popover invalidates any pending recording.
  const voice = useCoachSpeech({scopeKey: speechScopeKey, recordingId, utterance,
    ready: visible && !speechContext.pending && !speechContext.error, onManualRequest: onManualSpeech});
  if (!items.length) return null;
  const label = humanInsightLabels[items[0].code], {name, note, url} = humanSourceNotes(report);
  return <>
    <button className="human-insight-trigger" popoverTarget={id} aria-label={`${name}: ${label}`}>
      <span><b>{name}</b> · {label}</span><Info size={13} aria-hidden="true" />
    </button>
    <div className="human-insight-popover" id={id} popover="auto" role="dialog" aria-labelledby={`${id}-title`}
      onToggle={event => setVisible(event.newState === "open")}>
      <header>
        <h3 id={`${id}-title`}>{name} insight</h3>
        <CoachSpeechButton voice={voice} label="Listen to human-move insight" />
        <IconButton size="compact" variant="quiet" popoverTarget={id} popoverTargetAction="hide" aria-label="Close insight"><X size={18} aria-hidden="true" /></IconButton>
      </header>
      <DialogueText utterance={utterance} />
      <p className="human-insight-meaning">{humanInsightExplanation(items[0].code, report)}</p>
      <div className="human-insight-source">
        <span>{note}</span>
        {url && <a href={url} target="_blank" rel="noopener noreferrer">About Maia ↗</a>}
      </div>
    </div>
  </>;
}
