import { useState } from "react";
import { AudioLines, Check, Play } from "lucide-react";
import Button from "../../Button";
import ChoiceGroup from "../../ChoiceGroup";
import SourceLine from "../../SourceLine";
import "../../disclosure.css";
import recordedSources from "../assets/sources.json";
import { cueCatalog, paletteCatalog, productionCuePalettes } from "../catalog";
import type { AudioEvent } from "../engine";
import type { SoundCategory, SoundCue, SoundPalette } from "../model";
import { auditionScenarios, retryContexts, type RetryContextId } from "./scenarios";
import { useStudioPlayer } from "./useStudioPlayer";
import StudioTransport from "./StudioTransport";
import CastVoiceAudition from "./CastVoiceAudition";
import WalterWordingReview from "./WalterWordingReview";
import {walterWordingCatalog} from "./walterWording";
import RecordedCoachComparison from "./RecordedCoachComparison";
import {recordedCoachCatalog} from "./recordedCoachCatalog";
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
  const player = useStudioPlayer();
  const { events, stop, playCue, playScenario } = player;
  const [selectedScenario, setSelectedScenario] = useState(auditionScenarios[0].id);
  const [retryContextId, setRetryContextId] = useState<RetryContextId>("repeated");
  const visibleCues = cueCatalog.filter(cue => filter === "all" || cue.category === filter);
  const scenario = auditionScenarios.find(item => item.id === selectedScenario)!;
  const retryContext = retryContexts.find(item => item.id === retryContextId)!;

  const history = events.filter(event => event.type !== "requested" && event.type !== "ended").slice(-18).reverse();

  return <main className="audio-studio">
    <header className="audio-studio-heading">
      <div className="audio-studio-brand"><AudioLines size={22} aria-hidden="true" /><span>FIELDWORK / AUDIO STUDIO</span></div>
      <span className="audio-studio-badge">Development only</span>
      <h1>A little sound. A clearer game.</h1>
      <p>Choose voices for the cast, compare recordings in context, and preview the approved game sounds.</p>
    </header>

    <StudioTransport player={player} />

    <RecordedCoachComparison player={player} catalog={recordedCoachCatalog} />

    <WalterWordingReview player={player} catalog={walterWordingCatalog} />

    <CastVoiceAudition player={player} />

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
            {history.length ? <ol>{history.map(event => <li key={event.traceId} data-event-type={event.type} data-bus={event.bus} data-cue={event.cue} data-palette={event.palette} data-reason={event.reason}>
              <span>{event.type === "started" && <Check size={12} aria-hidden="true" />}{eventLabel(event)}</span>
              <strong>{event.bus === "speech" ? event.coachName ?? "Coach" : cueLabel(event.cue)}</strong><small>{event.bus === "speech" ? "Voice preview" : paletteLabel(event.palette)}{event.reason && ` · ${event.reason.replaceAll("-", " ")}`}</small>
            </li>)}</ol> : <p>No playback yet.</p>}
          </details>
        </section>
        <p className="audio-studio-speech-note">Completed voice banks are available in the application. Choose voices for the rest of the cast here.</p>
      </aside>
    </div>
    <footer className="audio-studio-footer">Casting choices save to this computer. Playback controls do not change account preferences.</footer>
  </main>;
}
