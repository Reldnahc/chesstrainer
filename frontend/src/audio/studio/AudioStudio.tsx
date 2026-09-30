import { useEffect, useRef, useState } from "react";
import { AudioLines, Check, Play, Square, Volume2, VolumeX } from "lucide-react";
import Button, { IconButton } from "../../Button";
import ChoiceGroup from "../../ChoiceGroup";
import SourceLine from "../../SourceLine";
import "../../disclosure.css";
import recordedSources from "../assets/sources.json";
import { cueCatalog, paletteCatalog, productionCuePalettes } from "../catalog";
import { AudioEngine, type AudioEvent } from "../engine";
import type { SoundCategory, SoundCue, SoundPalette } from "../model";
import { auditionScenarios, retryContexts, type AuditionScenario, type RetryContextId } from "./scenarios";
import "./studio.css";

type CueFilter = "all" | SoundCategory;
const cueFilters: readonly { value: CueFilter; label: string }[] = [
  { value: "all", label: "All cues" }, { value: "board", label: "Board" },
  { value: "practice", label: "Practice" },
];
const retryContextOptions = retryContexts.map(({ id, label }) => ({ value: id, label }));
const cueLabel = (cue?: SoundCue) => cueCatalog.find(item => item.id === cue)?.label ?? "Playback";
const paletteLabel = (palette?: SoundPalette) => paletteCatalog.find(item => item.id === palette)?.label ?? "";
const assetSources = new Map(recordedSources.assets.map(source => [`${source.palette}:${source.cue}`, source]));
const recordingSources = new Map(recordedSources.sources.map(source => [source.id, source]));
const sourceLicenses: Readonly<Record<string, { label: string; url: string } | undefined>> = recordedSources.licenses;

function CueSource({ cue, palette }: { cue: SoundCue; palette: SoundPalette }) {
  const source = assetSources.get(`${palette}:${cue}`);
  if (!source) return null;
  const credits = [...new Set(source.takes.map(take => take.source))].flatMap(id => {
    const recording = recordingSources.get(id);
    return recording ? [recording] : [];
  });
  return <details className="disclosure audio-studio-source">
    <summary aria-label={`Source for ${cueLabel(cue)} · ${paletteLabel(palette)}`}>Source</summary>
    {credits.map(credit => {
      const license = sourceLicenses[credit.license];
      return <SourceLine key={credit.id} text={`${credit.title} — ${credit.author}`} url={credit.sourceUrl}
        license={license?.label ?? credit.license} licenseUrl={license?.url} />;
    })}
    <SourceLine className="audio-studio-source-modifications" text={source.modifications} />
  </details>;
}

function eventLabel(event: AudioEvent) {
  if (event.type === "started") return "Played";
  if (event.type === "cancelled") return "Cancelled";
  if (event.type === "suppressed") return "Kept quiet";
  if (event.type === "error") return "Unavailable";
  return "Finished";
}

export default function AudioStudio() {
  const [filter, setFilter] = useState<CueFilter>("all");
  const [volume, setVolume] = useState(35);
  const [muted, setMuted] = useState(false);
  const [events, setEvents] = useState<(AudioEvent & { traceId: number })[]>([]);
  const [status, setStatus] = useState("Ready when you are. Press Play to start listening.");
  const [error, setError] = useState("");
  const [selectedScenario, setSelectedScenario] = useState(auditionScenarios[0].id);
  const [retryContextId, setRetryContextId] = useState<RetryContextId>("repeated");
  const engineRef = useRef<AudioEngine | null>(null);
  const takeRef = useRef(0);
  const traceRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const visibleCues = cueCatalog.filter(cue => filter === "all" || cue.category === filter);
  const scenario = auditionScenarios.find(item => item.id === selectedScenario)!;
  const retryContext = retryContexts.find(item => item.id === retryContextId)!;

  useEffect(() => {
    let mounted = true;
    const engine = new AudioEngine({ onEvent(event) {
      if (!mounted) return;
      setEvents(previous => [...previous.slice(-79), { ...event, traceId: ++traceRef.current }]);
      if (event.type === "started") setStatus(`${cueLabel(event.cue)} · ${paletteLabel(event.palette)}`);
      if (event.type === "error") setError("This sound could not play. Try it again or check that audio is available in your browser.");
      if (event.type === "suppressed" && event.reason === "muted") setStatus("Muted. Unmute to hear your next preview.");
      if (event.type === "suppressed" && event.reason === "gesture-blocked") {
        setError("Audio is unavailable or blocked by the browser. Press Play again to retry.");
      }
    } });
    engine.setReady(true);
    engine.setPreferences({ enabled: true, volume: .35, board: true, practice: true });
    engineRef.current = engine;
    const pauseScenario = () => {
      if (document.visibilityState !== "hidden") return;
      takeRef.current++;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
    document.addEventListener("visibilitychange", pauseScenario);
    return () => {
      mounted = false;
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
    engineRef.current?.setPreferences({ enabled: true, volume: volume / 100, board: true, practice: true });
  }, [volume]);
  useEffect(() => {
    if (muted) {
      takeRef.current++;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    }
    engineRef.current?.setMuted(muted);
  }, [muted]);

  function stop() {
    takeRef.current++;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    engineRef.current?.stopAll();
    setStatus("Stopped. Ready for another listen.");
  }

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

  const history = events.filter(event => event.type !== "requested" && event.type !== "ended").slice(-18).reverse();

  return <main className="audio-studio">
    <header className="audio-studio-heading">
      <div className="audio-studio-brand"><AudioLines size={22} aria-hidden="true" /><span>FIELDWORK / AUDIO STUDIO</span></div>
      <span className="audio-studio-badge">Development only</span>
      <h1>A little sound. A clearer game.</h1>
      <p>Preview the nine approved game sounds, inspect their sources, and check playback in context.</p>
    </header>

    <section className="audio-studio-transport" aria-label="Playback controls">
      <div className="audio-studio-volume">
        <IconButton aria-label={muted ? "Unmute audio" : "Mute audio"} aria-pressed={muted} onClick={() => setMuted(value => !value)}>
          {muted ? <VolumeX size={19} aria-hidden="true" /> : <Volume2 size={19} aria-hidden="true" />}
        </IconButton>
        <label htmlFor="audition-volume">Volume <output htmlFor="audition-volume">{volume}%</output></label>
        <input id="audition-volume" type="range" min="0" max="100" value={volume} onChange={event => setVolume(Number(event.target.value))} />
      </div>
      <p className="audio-studio-now" role="status" aria-live="polite">{muted ? "Audio is muted." : status}</p>
      <Button onClick={stop} size="compact"><Square size={13} aria-hidden="true" />Stop all</Button>
    </section>
    {error && <p className="error-text" role="alert">{error}</p>}

    <div className="audio-studio-workspace">
      <section className="audio-studio-library" aria-labelledby="cue-library-heading">
        <div className="audio-studio-section-heading">
          <div><span className="audio-studio-step">01 / APPROVED SOUNDS</span><h2 id="cue-library-heading">The game sound set</h2></div>
          <span className="audio-studio-count">{cueCatalog.length} cues</span>
        </div>
        <ChoiceGroup label="Cue category" value={filter} options={cueFilters} onChange={setFilter} />
        <div className="audio-studio-cues">
          {visibleCues.map(cue => {
            const palette = paletteCatalog.find(item => item.id === productionCuePalettes[cue.id]);
            if (!palette) return null;
            return <article key={cue.id} className="audio-studio-cue-row" data-cue={cue.id} data-palette={palette.id} aria-labelledby={`cue-${cue.id}`}>
              <div className="audio-studio-cue-name"><h3 id={`cue-${cue.id}`}>{cue.label}</h3><p>{cue.description}</p></div>
              <div className="audio-studio-cue-preview">
                <span className="audio-studio-palette-name">{palette.label}</span>
                <Button size="compact" variant="secondary" aria-label={`Play ${cue.label} · ${palette.label}`} onClick={() => void playCue(cue.id, palette.id)}>
                  <Play size={13} aria-hidden="true" />Play
                </Button>
              </div>
              <CueSource cue={cue.id} palette={palette.id} />
              {cue.id === "retry" && <div className="audio-studio-context-controls">
                <ChoiceGroup label="Retry context" value={retryContextId} options={retryContextOptions}
                  onChange={value => { stop(); setRetryContextId(value); }} />
                <p id="retry-context-description" className="audio-studio-context-description"><strong>About {retryContext.durationSeconds} seconds.</strong> {retryContext.description}</p>
                <Button size="compact" aria-label="Hear Try again in context" aria-describedby="retry-context-description" onClick={() => void playScenario(retryContext)}>In context</Button>
              </div>}
            </article>;
          })}
        </div>
      </section>

      <aside className="audio-studio-sidebar">
        <section className="audio-studio-panel" aria-labelledby="scenario-heading">
          <span className="audio-studio-step">02 / IN CONTEXT</span><h2 id="scenario-heading">Hear the flow</h2>
          <p>Uses the same sound mapping and player as the application.</p>
          <label>Scenario<select value={selectedScenario} onChange={event => { stop(); setSelectedScenario(event.target.value); }}>
            {auditionScenarios.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
          <p className="audio-studio-scenario-description">{scenario.description}</p>
          <Button variant="primary" onClick={() => void playScenario(scenario)}><Play size={15} aria-hidden="true" />Play scenario</Button>
        </section>

        <section className="audio-studio-panel audio-studio-history" aria-label="Playback history">
          <details className="disclosure audio-studio-details">
            <summary>Playback history <span>{history.filter(event => event.type === "started").length} played</span></summary>
            <p>Live events from the shared audio player.</p>
            {history.length ? <ol>{history.map(event => <li key={event.traceId} data-event-type={event.type} data-cue={event.cue} data-palette={event.palette} data-reason={event.reason}>
              <span>{event.type === "started" && <Check size={12} aria-hidden="true" />}{eventLabel(event)}</span>
              <strong>{cueLabel(event.cue)}</strong><small>{paletteLabel(event.palette)}{event.reason && ` · ${event.reason.replaceAll("-", " ")}`}</small>
            </li>)}</ol> : <p>No playback yet.</p>}
          </details>
        </section>
        <p className="audio-studio-speech-note">Speech is reserved for a later pass. This studio previews sound effects only.</p>
      </aside>
    </div>
    <footer className="audio-studio-footer">Audio studio · Preview controls do not change account preferences.</footer>
  </main>;
}
