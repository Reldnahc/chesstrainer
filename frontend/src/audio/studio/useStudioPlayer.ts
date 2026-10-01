import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine, type AudioEvent } from "../engine";
import { cueCatalog, paletteCatalog } from "../catalog";
import type { RecordedSpeechClip, SoundCue, SoundPalette, SpeechPlayback } from "../model";
import type { CoachUtterance } from "../../dialogue/model";
import type { AuditionScenario } from "./scenarios";

export type StudioSpeechPlayback = {
  state: "idle" | "loading" | "playing";
  voiceId?: string;
  scriptId?: string;
  coachId?: string;
  coachName?: string;
  eventId?: string;
};
export type StudioSpeechRequest = {
  url: string;
  voiceId: string;
  voiceName: string;
  scriptId: string;
  coachName: string;
  utterance: CoachUtterance;
  recordingId?: string;
};
const cueLabel = (cue?: SoundCue) => cueCatalog.find(item => item.id === cue)?.label ?? "Playback";
const paletteLabel = (palette?: SoundPalette) => paletteCatalog.find(item => item.id === palette)?.label ?? "";

/** One development player shared by sound, voice and coach-inspector auditions. */
export function useStudioPlayer() {
  const [volume, setVolume] = useState(35);
  const [muted, setMuted] = useState(false);
  const [events, setEvents] = useState<(AudioEvent & { traceId: number; coachName?: string })[]>([]);
  const [status, setStatus] = useState("Ready when you are. Press Play to start listening.");
  const [error, setError] = useState("");
  const [speechPlayback, setSpeechPlayback] = useState<StudioSpeechPlayback>({ state: "idle" });
  const [speaking, setSpeaking] = useState<SpeechPlayback | null>(null);
  const speechRef = useRef<StudioSpeechPlayback>({ state: "idle" });
  const contextSpeechRef = useRef<{ moveEventId: string; clip: RecordedSpeechClip } | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const takeRef = useRef(0);
  const traceRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    let mounted = true;
    const engine = new AudioEngine({ onSpeechPlayback(playback) {
      if (mounted) setSpeaking(playback);
    }, onEvent(event) {
      if (!mounted) return;
      setEvents(previous => [...previous.slice(-79), { ...event, coachName: speechRef.current.coachName, traceId: ++traceRef.current }]);
      if (event.type === "started") setStatus(event.bus === "speech" ? `${speechRef.current.coachName ?? "Coach"} · Voice preview` : `${cueLabel(event.cue)} · ${paletteLabel(event.palette)}`);
      const pending = contextSpeechRef.current;
      if (pending?.moveEventId === event.eventId) {
        if (event.type === "started") {
          // Measure the pause from audible movement, not an unpredictable download.
          contextSpeechRef.current = null;
          engine.playRecordedSpeech(pending.clip);
        } else if (["cancelled", "suppressed", "error"].includes(event.type)) {
          contextSpeechRef.current = null;
          speechRef.current = { state: "idle" };
          setSpeechPlayback({ state: "idle" });
        }
      }
      if (event.bus === "speech" && event.eventId === speechRef.current.eventId) {
        if (event.type === "started") setSpeechPlayback({ ...speechRef.current, state: "playing" });
        if (["ended", "cancelled", "suppressed", "error"].includes(event.type)) setSpeechPlayback({ state: "idle" });
      }
      if (event.type === "error") {
        setStatus("Playback unavailable. Ready to retry.");
        setError("This sound could not play. Try it again or check that audio is available in your browser.");
      }
      if (event.type === "suppressed" && event.reason === "muted") setStatus("Muted. Unmute to hear your next preview.");
      if (event.type === "suppressed" && event.reason === "gesture-blocked") {
        setStatus("Playback unavailable. Ready to retry.");
        setError("Audio is unavailable or blocked by the browser. Press Play again to retry.");
      }
    } });
    engine.setReady(true);
    engine.setPreferences({ enabled: true, volume: .35, board: true, practice: true, voice: "manual" });
    engineRef.current = engine;
    const pauseScenario = () => {
      if (document.visibilityState !== "hidden") return;
      takeRef.current++;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      contextSpeechRef.current = null;
      speechRef.current = { state: "idle" };
      setSpeechPlayback({ state: "idle" });
    };
    document.addEventListener("visibilitychange", pauseScenario);
    return () => {
      mounted = false;
      contextSpeechRef.current = null;
      takeRef.current++;
      timersRef.current.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", pauseScenario);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (volume === 0) {
      takeRef.current++;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    }
    engineRef.current?.setPreferences({ enabled: true, volume: volume / 100, board: true, practice: true, voice: "manual" });
  }, [volume]);
  useEffect(() => {
    if (muted) {
      takeRef.current++;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    }
    engineRef.current?.setMuted(muted);
  }, [muted]);

  const stop = useCallback(() => {
    takeRef.current++;
    contextSpeechRef.current = null;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    engineRef.current?.stopAll();
    speechRef.current = { state: "idle" };
    setSpeechPlayback({ state: "idle" });
    setStatus("Stopped. Ready for another listen.");
  }, []);

  async function begin() {
    stop();
    setError("");
    const engine = engineRef.current;
    const take = takeRef.current;
    if (!engine) return;
    try {
      await engine.unlock();
      if (take !== takeRef.current || engine !== engineRef.current) return;
      return { engine, take, scope: `studio:${take}` };
    } catch {
      setError("Audio could not start. Press Play again to retry.");
    }
  }

  async function playCue(cue: SoundCue, palette: SoundPalette) {
    const audition = await begin();
    if (!audition) return;
    audition.engine.play({ cue, palette, scope: audition.scope, eventId: `${audition.scope}:${cue}` });
  }

  async function playScenario(item: AuditionScenario) {
    const audition = await begin();
    if (!audition) return;
    const { engine, take, scope } = audition;
    for (const [index, step] of item.steps.entries()) {
      engine.play({ ...step, scope, eventId: `${scope}:${index}` });
    }
    if (item.skipAfterMs !== undefined && !muted && volume > 0) {
      timersRef.current.push(setTimeout(() => {
        if (take !== takeRef.current) return;
        engine.cancel(scope);
        engine.play({ cue: "move", scope: `${scope}:next`, eventId: `${scope}:next:move` });
        setStatus("Jumped ahead. Feedback from the previous position was cancelled.");
      }, item.skipAfterMs));
    }
  }

  async function playSpeech(request: StudioSpeechRequest, inContext = false) {
    const audition = await begin();
    if (!audition) return;
    const { engine, scope } = audition;
    const {voiceId, scriptId, coachName, voiceName, utterance} = request;
    const eventId = `${scope}:speech:${voiceId}:${scriptId}`;
    speechRef.current = { state: "loading", voiceId, scriptId, coachName, coachId: utterance.coachId, eventId };
    setSpeechPlayback(speechRef.current);
    setStatus(`Loading ${coachName} · ${voiceName}…`);
    const recording = { url: request.url, utterance, recordingId: request.recordingId,
      scope, eventId, delayMs: inContext ? 350 : 0 };
    if (inContext) {
      contextSpeechRef.current = { moveEventId: `${scope}:move`, clip: recording };
      engine.play({ cue: "move", scope, eventId: `${scope}:move` });
    } else engine.playRecordedSpeech(recording);
  }

  return {volume, setVolume, muted, setMuted, events, status, error, speechPlayback, speaking,
    stop, playCue, playScenario, playSpeech};
}

export type StudioPlayer = ReturnType<typeof useStudioPlayer>;
