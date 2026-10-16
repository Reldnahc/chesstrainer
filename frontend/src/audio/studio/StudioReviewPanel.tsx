import type {ReactNode} from "react";
import {Play} from "lucide-react";
import Button from "../../Button";
import ReviewCoach from "../../ReviewCoach";
import {CoachCharacter} from "../../coach/CoachCharacter";
import type {SelectableCoach} from "../../coach/model";
import type {SpeechMouthTrack} from "../../coach/speechMouth";
import type {MotionPreference} from "../../motion";
import type {StudioPlayer} from "./useStudioPlayer";
import "../../coach-presentation.css";
import "../../disclosure.css";
import "./voice-audition.css";

/** Whether this panel's clip is the one the studio player has loaded, playing, and speaking. */
export function studioSpeech(player: StudioPlayer, voiceId: string, scriptId: string | undefined) {
  const current = player.speechPlayback.voiceId === voiceId && player.speechPlayback.scriptId === scriptId;
  const playing = current && player.speechPlayback.state === "playing";
  const speech = playing && player.speaking?.eventId === player.speechPlayback.eventId ? player.speaking ?? undefined : undefined;
  return {current, playing, speech};
}

/** A select whose options are grouped by a category, as both recording reviews list their lines. */
export function GroupedSelect<T extends {id: string; label: string}>({label, value, items, group, onChange}: {
  label: string; value: string; items: readonly T[]; group: (item: T) => string; onChange: (id: string) => void;
}) {
  const groups = [...new Set(items.map(group))];
  return <label>{label}<select value={value} onChange={event => onChange(event.target.value)}>
    {groups.map(name => <optgroup key={name} label={name}>
      {items.filter(item => group(item) === name).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
    </optgroup>)}
  </select></label>;
}

/** The recorded coach speaking one clip, with Play and In context actions. */
export function StudioCoachPreview({coach, motion, playing, eventId, readyKey, speech, track, label, title, resetKey,
  playLabel, playText, contextLabel, disabled, onPlay, children}: {
  coach: SelectableCoach; motion: MotionPreference; playing: boolean; eventId: string | undefined; readyKey: string;
  speech: ReturnType<typeof studioSpeech>["speech"]; track: SpeechMouthTrack | undefined; label: string;
  title: ReactNode; resetKey: string; playLabel: string; playText: ReactNode; contextLabel: string;
  disabled: boolean; onPlay: (inContext: boolean) => void; children: ReactNode;
}) {
  return <ReviewCoach title={title} portraitCaption={coach.name} messageResetKey={resetKey}
    character={<CoachCharacter coach={coach} motion={motion}
      reaction={{state: playing ? "explaining" : "neutral", key: playing ? eventId! : readyKey}}
      speech={speech} speechTrack={track} label={label} />}
    actions={<>
      <Button variant="primary" aria-label={playLabel} disabled={disabled} onClick={() => onPlay(false)}><Play size={15} aria-hidden="true" />{playText}</Button>
      <Button aria-label={contextLabel} disabled={disabled} onClick={() => onPlay(true)}>In context</Button>
    </>}>{children}</ReviewCoach>;
}

/** The shell both recording reviews share: a heading, the controls and the coach preview. */
export function StudioReviewPanel({id, className, playback, title, description, controls, preview}: {
  id: string; className: string; playback: string; title: ReactNode; description: ReactNode;
  controls: ReactNode; preview: ReactNode;
}) {
  return <section className={`voice-audition ${className}`} aria-labelledby={`${id}-heading`} data-playback={playback}>
    <header className="voice-audition-heading">
      <h2 id={`${id}-heading`}>{title}</h2>
      <p>{description}</p>
    </header>
    <div className="voice-audition-layout">
      <div className="voice-audition-controls voice-audition-fields">{controls}</div>
      <div className="voice-audition-preview">{preview}</div>
    </div>
  </section>;
}
