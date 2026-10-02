import { Volume2, VolumeX } from "lucide-react";
import { IconButton } from "../Button";
import { useOptionalAudioPreferences } from "./AudioProvider";

export default function AudioMuteButton() {
  const state = useOptionalAudioPreferences();
  if (!state) return null;
  const disabled = !state.ready || !state.preferences.enabled || state.preferences.volume === 0;
  return <IconButton className="audio-quick-mute" disabled={disabled}
    aria-label={state.muted ? "Unmute sound on this device" : "Mute sound on this device"}
    aria-pressed={state.muted} title={disabled ? "Sound is off in Settings" : "Mute affects only this device"}
    onClick={() => state.setMuted(!state.muted)}>
    {state.muted || disabled ? <VolumeX size={18} /> : <Volume2 size={18} />}
  </IconButton>;
}
