import { useEffect, useId, useState } from "react";
import { Play } from "lucide-react";
import Button from "../../Button";
import ChoiceGroup from "../../ChoiceGroup";
import MotionSelect from "../../MotionSelect";
import ReviewCoach from "../../ReviewCoach";
import { CoachCharacter } from "../../coach/CoachAvatar";
import { getCoach } from "../../coach/registry";
import type { SpeechMouthTrack } from "../../coach/speechMouth";
import type { MotionPreference } from "../../motion";
import type { CoachUtterance } from "../../dialogue/model";
import type { StudioPlayer } from "./useStudioPlayer";
import "../../coach-presentation.css";
import "../../disclosure.css";
import "./voice-audition.css";
import "./walter-wording.css";

export type WordingVersion = "original" | "revised";
export type WordingExample = {
  id: string; label: string; category: string; previousText: string; text: string; reason: string; featured: boolean;
};
export type WordingClip = {id: string; text: string; url: string; track: SpeechMouthTrack};
export type WordingCatalog = {
  examples: readonly WordingExample[];
  loadClip: (id: string, version: WordingVersion) => Promise<WordingClip | undefined>;
};
const walter = getCoach("classic");

/** Wording comparison only: Walter's chosen voice and production preferences stay fixed. */
export default function WalterWordingReview({player, catalog}: {player: StudioPlayer; catalog: WordingCatalog}) {
  const id = useId();
  const [collection, setCollection] = useState<"featured" | "all">("featured");
  const [exampleId, setExampleId] = useState<string>();
  const [version, setVersion] = useState<WordingVersion>("revised");
  const [motion, setMotion] = useState<MotionPreference>("system");
  const examples = catalog.examples.filter(example => collection === "all" || example.featured);
  const example = examples.find(item => item.id === exampleId) ?? examples[0];
  const clipKey = `${version}:${example?.id ?? ""}`;
  const [loaded, setLoaded] = useState<{key: string; clip?: WordingClip}>();
  useEffect(() => {
    if (!example) return;
    let current = true;
    void catalog.loadClip(example.id, version).then(clip => {
      if (current) setLoaded({key: clipKey, clip});
    }, () => {if (current) setLoaded({key: clipKey});});
    return () => {current = false;};
  }, [catalog, example?.id, version, clipKey]);
  if (!example) return null;

  const clip = loaded?.key === clipKey ? loaded.clip : undefined;
  const voiceId = `walter-wording-${version}`;
  const current = player.speechPlayback.voiceId === voiceId && player.speechPlayback.scriptId === example.id;
  const playing = current && player.speechPlayback.state === "playing";
  const speech = playing && player.speaking?.eventId === player.speechPlayback.eventId ? player.speaking ?? undefined : undefined;
  const text = version === "original" ? example.previousText : example.text;
  const categories = [...new Set(examples.map(item => item.category))];
  function play(inContext: boolean) {
    if (!clip || !example) return;
    const utterance: CoachUtterance = {
      version: "coach-utterance-1", id: `development:walter-wording:${clipKey}`,
      intentId: `development:wording:${example.id}`, coachId: walter.id,
      text: clip.text, speechText: clip.text, expression: "explaining",
      intensity: .4, priority: 50, interruptible: true, autoSpeakSuitable: false,
      trace: {renderer: "development-walter-wording", variants: [], decisions: [
        "Manual comparison of original and revised wording in Walter's locked voice.",
        "This preview does not change analysis, casting choices or account preferences.",
      ]},
    };
    void player.playSpeech({url: clip.url, recordingId: clip.id, voiceId,
      voiceName: version === "original" ? "Original wording" : "Revised wording",
      scriptId: example.id, coachName: walter.name, utterance}, inContext);
  }
  return <section className="voice-audition walter-wording" aria-labelledby={`${id}-heading`}
    data-playback={current ? player.speechPlayback.state : "idle"}>
    <header className="voice-audition-heading">
      <h2 id={`${id}-heading`}>Walter wording</h2>
      <p>The same Walter voice, with clearer explanations. Compare the original and revised recordings.</p>
    </header>
    <div className="voice-audition-layout">
      <div className="voice-audition-controls voice-audition-fields">
        <ChoiceGroup label="Example collection" value={collection}
          options={[{value: "featured", label: "A few examples"}, {value: "all", label: "All revised clips"}]}
          onChange={next => {if (next !== collection) {player.stop(); setCollection(next);}}} />
        <label>Wording example<select value={example.id} onChange={event => {player.stop(); setExampleId(event.target.value);}}>
          {categories.map(category => <optgroup key={category} label={category}>
            {examples.filter(item => item.category === category).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </optgroup>)}
        </select></label>
        <ChoiceGroup label="Wording version" value={version}
          options={[{value: "original", label: "Original"}, {value: "revised", label: "Revised"}]}
          onChange={next => {if (next !== version) {player.stop(); setVersion(next);}}} />
        <MotionSelect id={`${id}-motion`} label="Walter motion" value={motion} onChange={setMotion} />
        <p className="voice-audition-note">{example.reason}</p>
        <details className="disclosure voice-audition-texts">
          <summary>Compare the text</summary>
          <dl><dt>Original</dt><dd>{example.previousText}</dd><dt>Revised</dt><dd>{example.text}</dd></dl>
        </details>
      </div>
      <div className="voice-audition-preview">
        <ReviewCoach title={<strong>{version === "original" ? "Original" : "Revised"} · {example.label}</strong>} portraitCaption={walter.name}
          messageResetKey={clipKey}
          character={<CoachCharacter coach={walter} motion={motion}
            reaction={{state: playing ? "explaining" : "neutral", key: playing ? player.speechPlayback.eventId! : "walter-wording-ready"}}
            speech={speech} speechTrack={clip?.track} label="Walter, wording comparison" />}
          actions={<>
            <Button variant="primary" aria-label={`Play ${version} Walter wording`} disabled={!clip} onClick={() => play(false)}><Play size={15} aria-hidden="true" />Play {version}</Button>
            <Button aria-label="Walter wording in context" disabled={!clip} onClick={() => play(true)}>In context</Button>
          </>}><p>{text}</p></ReviewCoach>
        {!clip && <p className="walter-wording-status" role="status">{loaded?.key === clipKey ?
          "This recording and its mouth timing are still being prepared." : "Loading recording details…"}</p>}
      </div>
    </div>
  </section>;
}
