import { useState } from "react";
import { Play } from "lucide-react";
import Button from "../../Button";
import ChoiceGroup from "../../ChoiceGroup";
import MotionSelect from "../../MotionSelect";
import type { MotionPreference } from "../../motion";
import ReviewCoach from "../../ReviewCoach";
import SourceLine from "../../SourceLine";
import { CoachCharacter } from "../../coach/CoachAvatar";
import { getCoach } from "../../coach/registry";
import type { SpeechPlayback } from "../model";
import { walterAlignment } from "../speech/alignment/previewTracks";
import WalterMouthComparison from "./WalterMouthComparison";
import type { WalterClip, WalterCollection, WalterScript, WalterVoice } from "../speech/walterPilot";
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

export default function WalterAudition({ collections, voices, scripts, clips, playback, speaking, onPlay, onStop }: {
  collections: readonly WalterCollection[];
  voices: readonly WalterVoice[];
  scripts: readonly WalterScript[];
  clips: readonly WalterClip[];
  playback: WalterPlayback;
  speaking: SpeechPlayback | null;
  onPlay: (clip: WalterClip, options: WalterPlayOptions) => void;
  onStop: () => void;
}) {
  const [collectionId, setCollectionId] = useState(collections[0]?.id);
  const [voiceId, setVoiceId] = useState(collections[0]?.voiceIds[0]);
  const [scriptId, setScriptId] = useState(collections[0]?.scriptIds[0]);
  const [motion, setMotion] = useState<MotionPreference>("system");
  const [preview, setPreview] = useState<'voice' | 'mouths'>('voice');
  const voice = voices.find(item => item.id === voiceId);
  const script = scripts.find(item => item.id === scriptId);
  const collection = collections.find(item => item.id === collectionId);
  if (!voice || !script || !collection) return null;
  const collectionVoices = collection.voiceIds.flatMap(id => {
    const candidate = voices.find(item => item.id === id);
    return candidate ? [candidate] : [];
  });
  const collectionScripts = collection.scriptIds.flatMap(id => {
    const example = scripts.find(item => item.id === id);
    return example && (preview === 'voice' || walterAlignment(voice.id, example.id)) ? [example] : [];
  });
  const clip = clips.find(item => item.voiceId === voiceId && item.scriptId === scriptId);
  const current = playback.voiceId === voiceId && playback.scriptId === scriptId;
  const playing = current && playback.state === "playing";
  const reaction = { state: playing ? script.reaction : "neutral" as const, key: playing ? playback.eventId ?? `${voiceId}:${scriptId}` : "walter-ready" };
  const speech = playing && speaking && speaking.eventId === playback.eventId ? speaking : undefined;
  const alignment = walterAlignment(voice.id, script.id);
  const actions = <>
    <Button variant="primary" disabled={!clip} onClick={() => clip && onPlay(clip, { voice, script, inContext: false })}><Play size={15} aria-hidden="true" />Play voice</Button>
    <Button disabled={!clip} onClick={() => clip && onPlay(clip, { voice, script, inContext: true })}>In context</Button>
  </>;

  return <section className="walter-audition" aria-labelledby="walter-audition-heading" data-playback={current ? playback.state : "idle"}>
    <header className="walter-audition-heading">
      <div><span className="audio-studio-step">VOICE AUDITION</span><h2 id="walter-audition-heading">Find Walter’s voice</h2></div>
      <p>Watch Walter speak the teaching examples and compare earlier voice directions. These are fictional audition scripts, not analysis of a real game or automatic speech in the app.</p>
    </header>
    <div className="walter-audition-mode">
      <ChoiceGroup label="Voice preview mode" value={preview} options={[{value:'voice', label:'Voice audition'}, {value:'mouths', label:'Compare lip sync'}]}
        onChange={mode => {
          if (mode === preview) return;
          onStop();
          setPreview(mode);
          if (mode === 'mouths') {
            setCollectionId('walter-contrasts');
            setVoiceId('walter');
            if (!walterAlignment('walter', scriptId)) setScriptId('contrast-sound-sacrifice');
          }
        }} />
    </div>
    {preview === 'voice' && collections.length > 1 && <div className="walter-audition-collections">
      <ChoiceGroup label="Voice collection" value={collection.id} options={collections.map(item => ({ value: item.id, label: item.label }))}
        onChange={id => {
          if (id === collectionId) return;
          const next = collections.find(item => item.id === id);
          if (!next) return;
          onStop();
          setCollectionId(id);
          if (!next.voiceIds.includes(voice.id)) setVoiceId(next.voiceIds[0]);
          if (!next.scriptIds.includes(script.id)) setScriptId(next.scriptIds[0]);
        }} />
      <p>{collection.description}</p>
    </div>}
    <div className="walter-audition-layout">
      <div className="walter-audition-controls">
        {preview === 'voice' && <ChoiceGroup label="Voice candidate" value={voice.id} options={collectionVoices.map(item => ({ value: item.id, label: item.name }))}
          onChange={id => { if (id !== voiceId) { onStop(); setVoiceId(id); } }} />}
        <p className="walter-audition-description">{preview === 'mouths' ? 'Compare two automatic animation methods with the selected Older teacher voice. No new recordings or provider calls.' : voice.description}</p>
        {collectionScripts.length > 1 && <label>Speech example<select value={script.id} onChange={event => { onStop(); setScriptId(event.target.value); }}>
          {collectionScripts.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select></label>}
        <MotionSelect id="walter-preview-motion" label="Coach motion" value={motion} onChange={setMotion} />
        <p className="walter-audition-hint">In context plays a piece move, then Walter. His mouth follows the recording and rests during pauses. Still keeps the portrait static while audio plays.</p>
        <details className="disclosure walter-audition-source">
          <summary>Recording details</summary>
          <SourceLine text={`ElevenLabs · ${voice.sourceName} · Model ${voice.modelId ?? "provider-selected (Voice Remix)"}`}
            url="https://elevenlabs.io/text-to-speech" linkLabel="Voice provider" />
          <SourceLine text="Prerecorded clips play locally. Playback does not contact the voice provider." />
          {preview === 'mouths' && <SourceLine text="Mouth cues generated offline with Rhubarb Lip Sync 1.14.0, using the recording and its exact script."
            url="https://github.com/DanielSWolf/rhubarb-lip-sync" linkLabel="Lip sync tool" />}
        </details>
      </div>
      <div className="walter-audition-preview">
        {preview === 'mouths' && alignment ? <WalterMouthComparison reaction={reaction} motion={motion}
          speech={speech} track={alignment} text={script.spokenText} actions={actions} /> :
        <ReviewCoach title={<strong>{script.label}</strong>} portraitCaption={walter.name} messageResetKey={script.id}
          character={<CoachCharacter coach={walter} reaction={reaction} motion={motion}
            speech={speech}
            label={`${walter.name}, voice preview`} />}
          actions={actions}>
          <p>{script.writtenText}</p>
        </ReviewCoach>}
        {script.spokenText !== script.writtenText && <div className="walter-audition-transcript">
          <span>Spoken summary</span>
          <p>{script.spokenText}</p>
        </div>}
        {!clip && <p className="walter-audition-unavailable" role="status">Awaiting recordings. Voice playback will be available once the audition clips are ready.</p>}
      </div>
    </div>
  </section>;
}
