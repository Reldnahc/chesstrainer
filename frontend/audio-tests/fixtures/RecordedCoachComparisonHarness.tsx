import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import Button from "../../src/Button";
import RecordedCoachComparison, {type RecordedCoachCatalog} from "../../src/audio/studio/RecordedCoachComparison";
import StudioTransport from "../../src/audio/studio/StudioTransport";
import {useStudioPlayer, type StudioPlayer} from "../../src/audio/studio/useStudioPlayer";
import {installFakeSpeechAudio, type FakeSpeechAudio} from "./fakeSpeechAudio";
import "../../src/audio/studio/studio.css";

export type ComparisonHarnessOptions = {missingRecordings?: string[]; missingTracks?: string[]};
export type ComparisonHarness = {
  audio: FakeSpeechAudio;
  deferTrack: (key: string) => void;
  releaseTrack: (key: string) => void;
  state: () => {playback: string; coachId?: string; recordingId?: string; starts: number; stops: number; decodes: number};
};

/** Same semantic recording IDs, distinct coaches and recordings, with only audio hardware replaced. */
export function mountRecordedCoachComparison(options: ComparisonHarnessOptions = {}): ComparisonHarness {
  const audio = installFakeSpeechAudio();
  const held = new Set<string>();
  const pending = new Map<string, (() => void)[]>();
  const meanings = [
    {id: "book-opening-entry-1", label: "Enter the opening", group: "Opening run"},
    {id: "book-opening-follow-1", label: "Develop a piece", group: "Opening run"},
    {id: "book-opening-follow-2", label: "Continue development", group: "Opening run"},
    {id: "fork", label: "A fork", group: "Tactics"},
    {id: "maia-response", label: "A human reply", group: "Human guidance"},
    {id: "fork-with-maia", label: "A fork with Maia", group: "Combined", primary: "fork", secondary: "maia-response"},
  ];
  const catalog: RecordedCoachCatalog = {
    coaches: ["classic", "robot"], meanings,
    recording(coachId, id) {
      const meaning = meanings.find(item => item.id === id);
      if (!meaning || options.missingRecordings?.includes(`${coachId}:${id}`)) return undefined;
      return {id, text: `${coachId === "classic" ? "Walter" : "Rivet"}: ${meaning.label}.`,
        url: `/__recorded-comparison-fixture/${coachId}/${id}.mp3`};
    },
    async loadTrack(coachId, id) {
      const key = `${coachId}:${id}`;
      if (held.has(key)) await new Promise<void>(resolve => pending.set(key, [...(pending.get(key) ?? []), resolve]));
      if (options.missingTracks?.includes(key)) return undefined;
      return {durationSeconds: 10, cues: [
        {start: 0, end: 5, shape: coachId === "classic" ? "round" : "tongue"},
        {start: 5, end: 10, shape: "rest"},
      ]};
    },
  };
  let player: StudioPlayer | undefined;
  function Harness() {
    player = useStudioPlayer();
    const current = player;
    return <main className="audio-studio">
      <StudioTransport player={current} />
      <RecordedCoachComparison player={current} catalog={catalog} />
      <Button onClick={() => void current.playSpeech({url: "/__recorded-comparison-fixture/other/preview.mp3",
        voiceId: "another-preview", voiceName: "Another preview", scriptId: "other", recordingId: "other",
        coachName: "Other coach", utterance: {version: "coach-utterance-1", id: "other", intentId: "other", coachId: "robot",
          text: "Another preview.", speechText: "Another preview.", expression: "explaining", intensity: .4,
          priority: 50, interruptible: true, autoSpeakSuitable: false,
          trace: {renderer: "test-fixture", variants: [], decisions: []}}})}>Play another preview</Button>
    </main>;
  }
  const container = document.createElement("div");
  container.id = "recorded-comparison-harness";
  document.body.append(container);
  createRoot(container).render(<StrictMode><Harness /></StrictMode>);
  return {audio, deferTrack: key => {held.add(key);}, releaseTrack: key => {
    held.delete(key); pending.get(key)?.forEach(resolve => resolve()); pending.delete(key);
  }, state: () => ({playback: player?.speechPlayback.state ?? "idle", coachId: player?.speechPlayback.coachId,
    recordingId: player?.speaking?.recordingId, starts: audio.starts(), stops: audio.stops(), decodes: audio.decodes()})};
}
