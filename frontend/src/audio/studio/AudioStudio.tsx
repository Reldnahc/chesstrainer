import { useEffect, useRef, useState } from "react";
import { AudioLines, Check, Copy, Download, Play, Square, Volume2, VolumeX } from "lucide-react";
import Button, { IconButton } from "../../Button";
import ChoiceGroup from "../../ChoiceGroup";
import { cueCatalog, paletteCatalog } from "../catalog";
import { AudioEngine, type AudioEvent } from "../engine";
import type { SoundCategory, SoundCue, SoundPalette } from "../model";
import { auditionScenarios, type AuditionScenario } from "./scenarios";
import { exportStudioSelections, readStudioSelections, studioStorageKey, type StudioSelections } from "./selections";
import "./studio.css";

type CueFilter = "all" | SoundCategory;
const cueFilters: readonly { value: CueFilter; label: string }[] = [
  { value: "all", label: "All cues" }, { value: "board", label: "Board" },
  { value: "practice", label: "Practice" }, { value: "review", label: "Review" },
];
const cueLabel = (cue?: SoundCue) => cueCatalog.find(item => item.id === cue)?.label ?? "Playback";
const paletteLabel = (palette?: SoundPalette) => paletteCatalog.find(item => item.id === palette)?.label ?? "";

function eventLabel(event: AudioEvent) {
  if (event.type === "started") return "Played";
  if (event.type === "cancelled") return "Cancelled";
  if (event.type === "suppressed") return "Kept quiet";
  if (event.type === "error") return "Unavailable";
  return "Finished";
}

export default function AudioStudio() {
  const [selections, setSelections] = useState<StudioSelections>(readStudioSelections);
  const [filter, setFilter] = useState<CueFilter>("all");
  const [volume, setVolume] = useState(35);
  const [muted, setMuted] = useState(false);
  const [events, setEvents] = useState<(AudioEvent & { traceId: number })[]>([]);
  const [status, setStatus] = useState("Ready when you are. Press Play to start listening.");
  const [saveStatus, setSaveStatus] = useState("");
  const [error, setError] = useState("");
  const [scenarioPalette, setScenarioPalette] = useState<SoundPalette | "picks">("picks");
  const [selectedScenario, setSelectedScenario] = useState(auditionScenarios[0].id);
  const engineRef = useRef<AudioEngine | null>(null);
  const takeRef = useRef(0);
  const traceRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const visibleCues = cueCatalog.filter(cue => filter === "all" || cue.category === filter);
  const chosenCount = Object.keys(selections).length;
  const selectionJson = exportStudioSelections(selections);
  const scenario = auditionScenarios.find(item => item.id === selectedScenario)!;

  useEffect(() => {
    let mounted = true;
    const engine = new AudioEngine({ onEvent(event) {
      if (!mounted) return;
      setEvents(previous => [...previous.slice(-79), { ...event, traceId: ++traceRef.current }]);
      if (event.type === "started") setStatus(`${cueLabel(event.cue)} · ${paletteLabel(event.palette)}`);
      if (event.type === "error") setError("This sound could not play. Try it again or check that audio is available in your browser.");
      if (event.type === "suppressed" && event.reason === "muted") setStatus("Muted. Unmute to hear your next audition.");
      if (event.type === "suppressed" && event.reason === "gesture-blocked") {
        setError("Audio is unavailable or blocked by the browser. Press Play again to retry.");
      }
    } });
    engine.setReady(true);
    engine.setPreferences({ enabled: true, volume: .35, board: true, practice: true, review: true });
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
    engineRef.current?.setPreferences({ enabled: true, volume: volume / 100, board: true, practice: true, review: true });
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
    const paletteFor = (cue: SoundCue) => scenarioPalette === "picks" ? selections[cue] ?? "warm-wood" : scenarioPalette;
    for (const [index, step] of item.steps.entries()) {
      engine.play({ ...step, palette: paletteFor(step.cue), scope, eventId: `${scope}:${index}` });
    }
    if (item.skipAfterMs !== undefined && !muted && volume > 0) {
      timersRef.current.push(setTimeout(() => {
        if (take !== takeRef.current) return;
        engine.cancel(scope);
        engine.play({ cue: "move", palette: paletteFor("move"), scope: `${scope}:next`, eventId: `${scope}:next:move` });
        setStatus("Jumped ahead. Feedback from the previous position was cancelled.");
      }, item.skipAfterMs));
    }
  }

  function choose(cue: SoundCue, palette: SoundPalette) {
    const next = { ...selections, [cue]: palette };
    setSelections(next);
    try {
      localStorage.setItem(studioStorageKey, JSON.stringify(next));
      setSaveStatus(`${cueLabel(cue)} pick saved in this browser.`);
    } catch {
      setSaveStatus("Browser storage is unavailable. Export your picks before leaving.");
    }
  }

  async function copySelections() {
    try {
      await navigator.clipboard.writeText(selectionJson);
      setSaveStatus("Copied your cue mapping.");
    } catch {
      setSaveStatus("Clipboard is unavailable. Select the mapping below or download the JSON file.");
    }
  }

  function downloadSelections() {
    const url = URL.createObjectURL(new Blob([selectionJson], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "fieldwork-audio-picks.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setSaveStatus("Downloaded your cue mapping.");
  }

  const history = events.filter(event => event.type !== "requested" && event.type !== "ended").slice(-18).reverse();

  return <main className="audio-studio">
    <header className="audio-studio-heading">
      <div className="audio-studio-brand"><AudioLines size={22} aria-hidden="true" /><span>FIELDWORK / AUDIO STUDIO</span></div>
      <span className="audio-studio-badge">Development only</span>
      <h1>A little sound. A clearer game.</h1>
      <p>Compare three sound palettes, choose a favorite for each cue, then hear your picks in context.</p>
    </header>

    <section className="audio-studio-transport" aria-label="Audition controls">
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
          <div><span className="audio-studio-step">01 / COMPARE</span><h2 id="cue-library-heading">Find the right feel</h2></div>
          <span className="audio-studio-count">{chosenCount} / {cueCatalog.length} picked</span>
        </div>
        <ChoiceGroup label="Cue category" value={filter} options={cueFilters} onChange={setFilter} />
        <div className="audio-studio-palette-headings">
          <span className="audio-studio-cue-heading">Cue</span>
          {paletteCatalog.map((palette, index) => <div key={palette.id} className="audio-studio-palette" data-palette={palette.id}>
            <span className="audio-studio-palette-number">0{index + 1}</span>
            <h3>{palette.label}</h3><p>{palette.description}</p>
          </div>)}
        </div>
        <div className="audio-studio-cues">
          {visibleCues.map(cue => <fieldset key={cue.id} className="audio-studio-cue-row" data-cue={cue.id}>
            <legend className="sr-only">{cue.label} palette</legend>
            <div className="audio-studio-cue-name"><h3>{cue.label}</h3><p>{cue.description}</p></div>
            {paletteCatalog.map(palette => <div key={palette.id} className="audio-studio-cue-option" data-picked={selections[cue.id] === palette.id} data-palette={palette.id}>
              <Button size="compact" variant="secondary" aria-label={`Play ${cue.label} · ${palette.label}`} onClick={() => void playCue(cue.id, palette.id)}>
                <Play size={13} aria-hidden="true" /><span>Play</span>
              </Button>
              <label className="audio-studio-pick">
                <input type="radio" name={`pick-${cue.id}`} value={palette.id} checked={selections[cue.id] === palette.id}
                  onChange={() => choose(cue.id, palette.id)} aria-label={`Choose ${palette.label} for ${cue.label}`} />
                <span>{selections[cue.id] === palette.id ? "Picked" : "Pick"}</span>
              </label>
            </div>)}
          </fieldset>)}
        </div>
      </section>

      <aside className="audio-studio-sidebar">
        <section className="audio-studio-panel" aria-labelledby="scenario-heading">
          <span className="audio-studio-step">02 / IN CONTEXT</span><h2 id="scenario-heading">Hear the flow</h2>
          <p>A good cue should feel right in a real sequence.</p>
          <label>Sound palette<select value={scenarioPalette} onChange={event => { stop(); setScenarioPalette(event.target.value as typeof scenarioPalette); }}>
            <option value="picks">My picks</option>{paletteCatalog.map(palette => <option key={palette.id} value={palette.id}>{palette.label}</option>)}
          </select></label>
          <label>Scenario<select value={selectedScenario} onChange={event => { stop(); setSelectedScenario(event.target.value); }}>
            {auditionScenarios.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
          <p className="audio-studio-scenario-description">{scenario.description}</p>
          <Button variant="primary" onClick={() => void playScenario(scenario)}><Play size={15} aria-hidden="true" />Play scenario</Button>
          <p className="audio-studio-footnote">{scenarioPalette === "picks" ? "Unpicked cues use Warm wood." : "This audition leaves your individual picks unchanged."}</p>
        </section>

        <section className="audio-studio-panel" aria-labelledby="picks-heading">
          <span className="audio-studio-step">03 / KEEP YOUR PICKS</span><h2 id="picks-heading">Your sound direction</h2>
          <p>Saved only in this browser’s studio. Export the mapping when you’re ready to apply it to the product.</p>
          <div className="audio-studio-export-actions">
            <Button size="compact" onClick={() => void copySelections()}><Copy size={14} aria-hidden="true" />Copy JSON</Button>
            <Button size="compact" onClick={downloadSelections}><Download size={14} aria-hidden="true" />Download</Button>
          </div>
          <p className="audio-studio-save-status" role="status">{saveStatus || `${chosenCount} cue ${chosenCount === 1 ? "pick" : "picks"} saved.`}</p>
          <details className="audio-studio-details"><summary>View cue mapping</summary><pre tabIndex={0} aria-label="Cue mapping JSON">{selectionJson}</pre></details>
        </section>

        <section className="audio-studio-panel audio-studio-history" aria-label="Playback history">
          <details className="audio-studio-details">
            <summary>Playback history <span>{history.filter(event => event.type === "started").length} played</span></summary>
            <p>Live events from the shared audio player.</p>
            {history.length ? <ol>{history.map(event => <li key={event.traceId} data-event-type={event.type} data-cue={event.cue} data-reason={event.reason}>
              <span>{event.type === "started" && <Check size={12} aria-hidden="true" />}{eventLabel(event)}</span>
              <strong>{cueLabel(event.cue)}</strong><small>{paletteLabel(event.palette)}{event.reason && ` · ${event.reason.replaceAll("-", " ")}`}</small>
            </li>)}</ol> : <p>No playback yet.</p>}
          </details>
        </section>
        <p className="audio-studio-speech-note">Speech is reserved for a later pass. This studio auditions sound effects only.</p>
      </aside>
    </div>
    <footer className="audio-studio-footer">Audio studio · Local audition choices do not change account preferences.</footer>
  </main>;
}
