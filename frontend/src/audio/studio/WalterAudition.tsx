import { useEffect, useState } from "react";
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
import type { SpeechMouthTrack } from "../../coach/speechMouth";
import { walterMouthTrack } from "../speech/voiceBank";
import { walterAlignment, walterOriginalAlignment } from "../speech/alignment/previewTracks";
import WalterMouthComparison from "./WalterMouthComparison";
import type { WalterClip, WalterCollection, WalterScript, WalterVoice } from "../speech/walterPilot";
import type { StudioSpeechPlayback } from "./useStudioPlayer";
import "../../coach-presentation.css";
import "./voice-audition.css";
import "./walter-audition.css";

const walter = getCoach("classic");
export type WalterPlayOptions = { voice: WalterVoice; script: WalterScript; inContext: boolean };

export default function WalterAudition({ collections, voices, scripts, clips, playback, speaking, onPlay, onStop }: {
  collections: readonly WalterCollection[];
  voices: readonly WalterVoice[];
  scripts: readonly WalterScript[];
  clips: readonly WalterClip[];
  playback: StudioSpeechPlayback;
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
  const recordingId = script?.recordingId;
  const [bankAlignment, setBankAlignment] = useState<{ id: string; track?: SpeechMouthTrack }>();
  useEffect(() => {
    if (!recordingId) return;
    let current = true;
    void walterMouthTrack(recordingId).then(track => {
      if (current) setBankAlignment({ id: recordingId, track });
    }, () => {
      if (current) setBankAlignment({ id: recordingId });
    });
    return () => { current = false; };
  }, [recordingId]);
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
  const originalAlignment = walterOriginalAlignment(voice.id, script.id);
  const speechTrack = bankAlignment?.id === recordingId ? bankAlignment?.track : undefined;
  const ready = !!clip && (!recordingId || !!speechTrack);
  const categories = [...new Set(collectionScripts.map(item => item.category).filter((item): item is string => !!item))];
  const option = (item: WalterScript) => <option key={item.id} value={item.id}>{item.label}</option>;
  const actions = <>
    <Button variant="primary" disabled={!ready} onClick={() => ready && clip && onPlay(clip, { voice, script, inContext: false })}><Play size={15} aria-hidden="true" />Play voice</Button>
    <Button disabled={!ready} onClick={() => ready && clip && onPlay(clip, { voice, script, inContext: true })}>In context</Button>
  </>;

  return <section className="voice-audition walter-audition" aria-labelledby="walter-audition-heading" data-playback={current ? playback.state : "idle"}>
    <header className="voice-audition-heading walter-audition-heading">
      <div><span className="audio-studio-step">VOICE AUDITION</span><h2 id="walter-audition-heading">Find Walter’s voice</h2></div>
      <p>Listen to Walter’s complete voice bank, watch his mouth follow the recording, or compare earlier voice directions. These are standalone examples, not analysis of a real game.</p>
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
    <div className="voice-audition-layout walter-audition-layout">
      <div className="voice-audition-controls walter-audition-controls">
        {preview === 'voice' && <ChoiceGroup label="Voice candidate" value={voice.id} options={collectionVoices.map(item => ({ value: item.id, label: item.name }))}
          onChange={id => { if (id !== voiceId) { onStop(); setVoiceId(id); } }} />}
        <p className="walter-audition-description">{preview === 'mouths' ? 'Compare the first generator with revised script-aligned timing. Both use the same Older teacher recording and unchanged mouth artwork.' : recordingId ? 'Walter’s selected Older teacher voice. Each complete summary uses the same automatic mouth timing as the application.' : voice.description}</p>
        {collectionScripts.length > 1 && <label>Speech example<select value={script.id} onChange={event => { onStop(); setScriptId(event.target.value); }}>
          {categories.length ? categories.map(category => <optgroup key={category} label={category}>
            {collectionScripts.filter(item => item.category === category).map(option)}
          </optgroup>) : collectionScripts.map(option)}
        </select></label>}
        <MotionSelect id="walter-preview-motion" label="Coach motion" value={motion} onChange={setMotion} />
        <p className="walter-audition-hint">In context plays a piece move, then Walter. His mouth follows the recording and rests during pauses. Still keeps the portrait static while audio plays.</p>
        <details className="disclosure walter-audition-source">
          <summary>Recording details</summary>
          <SourceLine text={`ElevenLabs · ${voice.sourceName} · Model ${voice.modelId ?? "provider-selected (Voice Remix)"}`}
            url="https://elevenlabs.io/text-to-speech" linkLabel="Voice provider" />
          <SourceLine text="Prerecorded clips play locally. Playback does not contact the voice provider." />
          {recordingId && <SourceLine text="Mouth timing is generated automatically from the exact script and recording. No hand-edited clip timing." />}
          {preview === 'mouths' && <>
            <SourceLine text="First generator: Rhubarb Lip Sync 1.14.0."
              url="https://github.com/DanielSWolf/rhubarb-lip-sync" linkLabel="Original generator" />
            <SourceLine text="Revised generator: offline word/phoneme alignment with PocketSphinx 5.1.1, then shared sound-to-mouth rules."
              url="https://pocketsphinx.readthedocs.io/en/latest/pocketsphinx.html#pocketsphinx.Decoder.set_alignment" linkLabel="Alignment method" />
          </>}
        </details>
      </div>
      <div className="voice-audition-preview walter-audition-preview">
        {preview === 'mouths' && alignment && originalAlignment ? <WalterMouthComparison reaction={reaction} motion={motion}
          speech={speech} track={alignment} originalTrack={originalAlignment} text={script.spokenText} actions={actions} /> :
        <ReviewCoach title={<strong>{script.label}</strong>} portraitCaption={walter.name} messageResetKey={script.id}
          character={<CoachCharacter coach={walter} reaction={reaction} motion={motion}
            speech={speech}
            speechTrack={speechTrack}
            label={`${walter.name}, voice preview`} />}
          actions={actions}>
          <p>{script.writtenText}</p>
        </ReviewCoach>}
        {script.spokenText !== script.writtenText && <div className="walter-audition-transcript">
          <span>Spoken summary</span>
          <p>{script.spokenText}</p>
        </div>}
        {!clip && <p className="walter-audition-unavailable" role="status">Awaiting recordings. Voice playback will be available once the audition clips are ready.</p>}
        {!!clip && recordingId && !speechTrack && <p className="walter-audition-unavailable" role="status">
          {bankAlignment?.id === recordingId ? 'Mouth timing is unavailable for this recording.' : 'Loading mouth timing…'}
        </p>}
      </div>
    </div>
  </section>;
}
