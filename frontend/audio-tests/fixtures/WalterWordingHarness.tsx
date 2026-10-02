import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import Button from "../../src/Button";
import WalterWordingReview, {type WordingCatalog, type WordingVersion} from "../../src/audio/studio/WalterWordingReview";
import StudioTransport from "../../src/audio/studio/StudioTransport";
import {useStudioPlayer, type StudioPlayer} from "../../src/audio/studio/useStudioPlayer";
import type {SpeechMouthShape} from "../../src/coach/speechMouth";
import {installFakeSpeechAudio, type FakeSpeechAudio} from "./fakeSpeechAudio";
import "../../src/audio/studio/studio.css";

export type WordingHarnessOptions = {unavailable?: string[]};
export type WordingHarness = {
  audio: FakeSpeechAudio;
  deferClip: (key: string) => void;
  releaseClip: (key: string) => void;
  state: () => {playback: string; recordingId?: string; starts: number; stops: number; decodes: number};
  unmount: () => void;
};

/** Synthetic recordings exercise the real player and portrait without provider or casting calls. */
export function mountWalterWording(options: WordingHarnessOptions = {}): WordingHarness {
  const audio = installFakeSpeechAudio();
  const held = new Set<string>();
  const pending = new Map<string, (() => void)[]>();
  const examples = [
    {id: "fork", label: "A fork", category: "Tactics", previousText: "Original fork explanation.",
      text: "Revised fork explanation.", reason: "Explain both threats.", featured: true},
    {id: "defender", label: "A defender", category: "Tactics", previousText: "Original defender explanation.",
      text: "Revised defender explanation.", reason: "Explain the defender's job.", featured: true},
    {id: "pause", label: "Review paused", category: "Review guidance", previousText: "Original pause explanation.",
      text: "Revised pause explanation.", reason: "Keep the next step clear.", featured: false},
  ];
  const shapes: Record<string, Record<WordingVersion, SpeechMouthShape>> = {
    fork: {original: "round", revised: "tongue"}, defender: {original: "pucker", revised: "wide"},
    pause: {original: "closed", revised: "open"},
  };
  const catalog: WordingCatalog = {examples, async loadClip(id, version) {
    const key = `${id}:${version}`;
    if (held.has(key)) await new Promise<void>(resolve => pending.set(key, [...pending.get(key) ?? [], resolve]));
    const example = examples.find(item => item.id === id);
    if (!example || options.unavailable?.includes(key)) return undefined;
    return {id: key, text: version === "original" ? example.previousText : example.text,
      url: `/__wording-fixture/${id}/${version}.opus`, track: {durationSeconds: 10,
        cues: [{start: 0, end: 5, shape: shapes[id][version]}, {start: 5, end: 10, shape: "rest"}]}};
  }};
  let player: StudioPlayer | undefined;
  function Harness() {
    player = useStudioPlayer();
    const current = player;
    return <main className="audio-studio">
      <StudioTransport player={current} />
      <WalterWordingReview player={current} catalog={catalog} />
      <Button onClick={() => void current.playSpeech({url: "/__wording-fixture/other/revised.opus",
        voiceId: "other-cast-preview", voiceName: "Other preview", scriptId: "other", recordingId: "other:revised",
        coachName: "Other coach", utterance: {version: "coach-utterance-1", id: "other", intentId: "other", coachId: "robot",
          text: "Another preview.", speechText: "Another preview.", expression: "explaining", intensity: .4,
          priority: 50, interruptible: true, autoSpeakSuitable: false,
          trace: {renderer: "test-fixture", variants: [], decisions: []}}})}>Play another preview</Button>
    </main>;
  }
  const container = document.createElement("div");
  container.id = "walter-wording-harness";
  document.body.append(container);
  const mounted = createRoot(container);
  mounted.render(<StrictMode><Harness /></StrictMode>);
  return {audio, deferClip: key => {held.add(key);}, releaseClip: key => {
    held.delete(key); pending.get(key)?.forEach(resolve => resolve()); pending.delete(key);
  }, state: () => ({playback: player?.speechPlayback.state ?? "idle", recordingId: player?.speaking?.recordingId,
    starts: audio.starts(), stops: audio.stops(), decodes: audio.decodes()}),
  unmount: () => {mounted.unmount(); container.remove();}};
}
