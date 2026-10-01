import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import WalterAudition, { type WalterPlayOptions } from "../../src/audio/studio/WalterAudition";
import StudioTransport from "../../src/audio/studio/StudioTransport";
import { useStudioPlayer } from "../../src/audio/studio/useStudioPlayer";
import { walterClips, walterCollections, walterScripts, walterVoices,
  walterAuditionUtterance, type WalterClip } from "../../src/audio/speech/walterPilot";
import { walterBankCollection, walterBankScripts } from "../../src/audio/speech/walterBankAudition";
import { walterRecording } from "../../src/audio/speech/voiceBank";
import "../../src/audio/studio/studio.css";

const collections = [walterCollections[0], walterBankCollection, ...walterCollections.slice(1)];
const scripts = [...walterScripts, ...walterBankScripts];
const clips = [...walterClips, ...walterBankScripts.flatMap(script => {
  const recording = walterRecording(script.recordingId);
  return recording ? [{voiceId: "walter", scriptId: script.id, url: recording.url}] : [];
})];

export type WalterStudioOptions = {offscreenTarget?: boolean};

/** Legacy Walter previews stay test-only; playback still uses the shared controller. */
function WalterStudioHarness({offscreenTarget = false}: WalterStudioOptions) {
  const player = useStudioPlayer();
  function playVoice(clip: WalterClip, {voice, script, inContext}: WalterPlayOptions) {
    void player.playSpeech({url: clip.url, voiceId: voice.id, voiceName: voice.name,
      scriptId: script.id, coachName: "Walter", recordingId: script.recordingId,
      utterance: walterAuditionUtterance(voice, script)}, inContext);
  }
  const history = player.events.filter(event => event.type !== "requested" && event.type !== "ended").slice(-18).reverse();
  return <main className="audio-studio">
    <h1>Walter audition test fixture</h1>
    <StudioTransport player={player} />
    <WalterAudition collections={collections} voices={walterVoices} scripts={scripts} clips={clips}
      playback={player.speechPlayback} speaking={player.speaking} onPlay={playVoice} onStop={player.stop} />
    <ol hidden aria-label="Playback diagnostics">
      {history.map(event => <li key={event.traceId} data-event-type={event.type} data-bus={event.bus}
        data-cue={event.cue} data-palette={event.palette} data-reason={event.reason} />)}
    </ol>
    {offscreenTarget && <footer data-testid="walter-offscreen-target" style={{marginTop: "110vh"}}>End of fixture</footer>}
  </main>;
}

export function mountWalterStudio(options: WalterStudioOptions = {}) {
  const container = document.createElement("div");
  container.id = "walter-studio-harness";
  document.body.append(container);
  const mounted = createRoot(container);
  mounted.render(<StrictMode><WalterStudioHarness {...options} /></StrictMode>);
  return () => { mounted.unmount(); container.remove(); };
}
