import { useId } from "react";
import { Square, Volume2, VolumeX } from "lucide-react";
import Button, { IconButton } from "../../Button";
import type { StudioPlayer } from "./useStudioPlayer";
import "./studio-transport.css";

export default function StudioTransport({player}: {player: StudioPlayer}) {
  const volumeId = useId();
  const {volume, setVolume, muted, setMuted, status, error, stop} = player;
  return <>
    <section className="audio-studio-transport" aria-label="Playback controls">
      <div className="audio-studio-volume">
        <IconButton aria-label={muted ? "Unmute audio" : "Mute audio"} aria-pressed={muted} onClick={() => setMuted(value => !value)}>
          {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
        </IconButton>
        <label htmlFor={volumeId}>Volume <output htmlFor={volumeId}>{volume}%</output></label>
        <input id={volumeId} type="range" min="0" max="100" value={volume} onChange={event => setVolume(Number(event.target.value))} />
      </div>
      <p className="audio-studio-now" role="status" aria-live="polite">{muted ? "Audio is muted." : status}</p>
      <Button onClick={stop} size="compact"><Square size={13} aria-hidden="true" />Stop all</Button>
    </section>
    {error && <p className="error-text" role="alert">{error}</p>}
  </>;
}
