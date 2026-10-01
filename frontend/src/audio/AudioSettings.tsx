import { useEffect, useRef, useState } from "react";
import Button from "../Button";
import PreferenceStatus from "../PreferenceStatus";
import SettingsSection from "../SettingsSection";
import { useAudioPreferences, useAudioScope } from "./AudioProvider";
import type { AudioPreferences } from "./model";
import "./settings.css";

export default function AudioSettings() {
  const {preferences, ready, saving, error, save, retry, muted, setMuted} = useAudioPreferences();
  const sound = useAudioScope("settings-preview");
  const sequence = useRef(0);
  const writing = useRef(false);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState(preferences);
  const [volume, setVolume] = useState(preferences.volume);
  useEffect(() => { setDraft(preferences); setVolume(preferences.volume); }, [preferences]);
  async function update(next: Partial<AudioPreferences>) {
    if (writing.current) return;
    writing.current = true;
    setSaved(false);
    const value = {...preferences, ...next};
    setDraft(value);
    try {
      const success = await save(value);
      setSaved(success);
      if (!success) { setDraft(preferences); setVolume(preferences.volume); }
    } finally { writing.current = false; }
  }
  const disabled = !ready || saving;
  return <SettingsSection id="audio-settings" title="Sound"
    description="Sound follows your account. Quick mute applies only to this device.">
    <div className="audio-settings-controls">
      <label className="audio-setting-check"><input type="checkbox" checked={draft.enabled} disabled={disabled}
        onChange={event => void update({enabled: event.target.checked})} />Enable sound</label>
      <div className="audio-setting-volume">
        <label htmlFor="audio-volume">Volume <output htmlFor="audio-volume">{Math.round(volume * 100)}%</output></label>
        <input id="audio-volume" type="range" min="0" max="100" step="5" value={Math.round(volume * 100)}
          disabled={disabled || !draft.enabled}
          onChange={event => setVolume(Number(event.target.value) / 100)}
          onPointerUp={event => { const next = Number(event.currentTarget.value) / 100; if (next !== preferences.volume) void update({volume: next}); }}
          onKeyUp={event => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key) && volume !== preferences.volume) void update({volume}); }}
          onBlur={() => { if (!saving && volume !== preferences.volume) void update({volume}); }} />
      </div>
      <fieldset disabled={disabled || !draft.enabled} className="audio-setting-categories">
        <legend>Play sounds for</legend>
        {([
          ["board", "Board moves", "Moves, captures, castling, promotion, check and checkmate."],
          ["practice", "Practice feedback", "Accepted answers and completed practice."],
        ] as const).map(([key, label, description]) => <label className="audio-setting-check" key={key}>
          <input type="checkbox" checked={draft[key]} onChange={event => void update({[key]: event.target.checked})} />
          <span>{label}<small>{description}</small></span>
        </label>)}
      </fieldset>
      <div>
        <label htmlFor="coach-voice">Coach voice</label>
        <select id="coach-voice" value={draft.voice} disabled={disabled || !draft.enabled}
          aria-describedby="coach-voice-help"
          onChange={event => void update({voice: event.target.value as AudioPreferences["voice"]})}>
          <option value="automatic">Automatic</option>
          <option value="manual">On request</option>
          <option value="off">Off</option>
        </select>
        <p className="small muted" id="coach-voice-help">Walter has a recorded voice. Automatic reads supported coaching; On request plays it when you choose Listen. Other coaches remain text-only.</p>
      </div>
      <div className="button-row audio-setting-preview">
        <Button variant="secondary" disabled={disabled || !preferences.enabled || volume === 0 || muted || (!preferences.board && !preferences.practice)}
          onClick={async () => {
            await sound.unlock();
            sound.cancel();
            sound.play(preferences.board ? "move" : "correct", `preview:${++sequence.current}`);
          }}>Test sound</Button>
        {muted && <Button variant="quiet" onClick={() => setMuted(false)}>Unmute this device</Button>}
      </div>
      <PreferenceStatus ready={ready} saving={saving} error={error} saved={saved} retry={retry}
        retryLabel="Reload sound preferences" idleText={muted ? "Muted on this device" : undefined} />
    </div>
  </SettingsSection>;
}
