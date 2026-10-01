import { useState } from "react";
import { Play } from "lucide-react";
import Button from "../../Button";
import ChoiceGroup from "../../ChoiceGroup";
import ReviewCoach from "../../ReviewCoach";
import SourceLine from "../../SourceLine";
import { CoachCharacter } from "../../coach/CoachAvatar";
import { getCoach } from "../../coach/registry";
import type { WalterClip, WalterScript, WalterVoice } from "../speech/walterPilot";
import recordingPlan from "../speech/recording-plan.json" with { type: "json" };
import "../../coach-presentation.css";
import "./walter-audition.css";

const walter = getCoach("classic");
export type WalterPlayback = {
  state: "idle" | "loading" | "playing";
  voiceId?: string;
  scriptId?: string;
  eventId?: string;
};
export type WalterPlayOptions = { voice: WalterVoice; script: WalterScript; inContext: boolean };

export default function WalterAudition({ voices, scripts, clips, playback, onPlay, onStop }: {
  voices: readonly WalterVoice[];
  scripts: readonly WalterScript[];
  clips: readonly WalterClip[];
  playback: WalterPlayback;
  onPlay: (clip: WalterClip, options: WalterPlayOptions) => void;
  onStop: () => void;
}) {
  const [voiceId, setVoiceId] = useState(voices[0]?.id);
  const [scriptId, setScriptId] = useState(scripts[0]?.id);
  const voice = voices.find(item => item.id === voiceId);
  const script = scripts.find(item => item.id === scriptId);
  if (!voice || !script) return null;
  const clip = clips.find(item => item.voiceId === voiceId && item.scriptId === scriptId);
  const source = recordingPlan.voices.find(item => item.id === voiceId);
  const current = playback.voiceId === voiceId && playback.scriptId === scriptId;
  const playing = current && playback.state === "playing";
  const reaction = { state: playing ? script.reaction : "neutral" as const, key: playing ? playback.eventId ?? `${voiceId}:${scriptId}` : "walter-ready" };

  return <section className="walter-audition" aria-labelledby="walter-audition-heading" data-playback={current ? playback.state : "idle"}>
    <header className="walter-audition-heading">
      <div><span className="audio-studio-step">VOICE AUDITION</span><h2 id="walter-audition-heading">Find Walter’s voice</h2></div>
      <p>Compare the same teaching examples in every voice. These are audition scripts, not analysis of a real game or a voice selection for the app.</p>
    </header>
    <div className="walter-audition-layout">
      <div className="walter-audition-controls">
        <ChoiceGroup label="Voice candidate" value={voice.id} options={voices.map(item => ({ value: item.id, label: item.name }))}
          onChange={id => { if (id !== voiceId) { onStop(); setVoiceId(id); } }} />
        <p className="walter-audition-description">{voice.description}</p>
        <label>Speech example<select value={script.id} onChange={event => { onStop(); setScriptId(event.target.value); }}>
          {scripts.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select></label>
        <p className="walter-audition-hint">In context plays a piece move, then Walter. Volume, mute and Stop all above apply to both.</p>
        <details className="disclosure walter-audition-source">
          <summary>Recording details</summary>
          <SourceLine text={`ElevenLabs · ${source?.name ?? voice.name} · Model ${recordingPlan.modelId}`}
            url="https://elevenlabs.io/text-to-speech" linkLabel="Voice provider" />
          <SourceLine text="Prerecorded clips play locally. Playback does not contact the voice provider." />
        </details>
      </div>
      <div className="walter-audition-preview">
        <ReviewCoach title={<strong>{script.label}</strong>} portraitCaption={walter.name} messageResetKey={script.id}
          character={<CoachCharacter coach={walter} reaction={reaction} motion="system" label={`${walter.name}, voice preview`} />}
          actions={<>
            <Button variant="primary" disabled={!clip} onClick={() => clip && onPlay(clip, { voice, script, inContext: false })}><Play size={15} aria-hidden="true" />Play voice</Button>
            <Button disabled={!clip} onClick={() => clip && onPlay(clip, { voice, script, inContext: true })}>In context</Button>
          </>}>
          <p>{script.writtenText}</p>
        </ReviewCoach>
        {script.spokenText !== script.writtenText && <div className="walter-audition-transcript">
          <span>Spoken summary</span>
          <p>{script.spokenText}</p>
        </div>}
        {!clip && <p className="walter-audition-unavailable" role="status">Awaiting recordings. Voice playback will be available once the audition clips are ready.</p>}
      </div>
    </div>
  </section>;
}
