import {useEffect, useId, useState} from "react";
import {Play} from "lucide-react";
import Button from "../../Button";
import ChoiceGroup from "../../ChoiceGroup";
import MotionSelect from "../../MotionSelect";
import Notice from "../../Notice";
import ReviewCoach from "../../ReviewCoach";
import {CoachCharacter} from "../../coach/CoachAvatar";
import {getCoach} from "../../coach/registry";
import type {SpeechMouthTrack} from "../../coach/speechMouth";
import type {CoachUtterance} from "../../dialogue/model";
import type {MotionPreference} from "../../motion";
import type {StudioPlayer} from "./useStudioPlayer";
import "../../coach-presentation.css";
import "../../disclosure.css";
import "./voice-audition.css";

export type RecordingMeaning = {id: string; label: string; group: string};
export type RecordedCoachCatalog = {
  coaches: readonly string[];
  meanings: readonly RecordingMeaning[];
  recording: (coachId: string, id: string) => {id: string; text: string; url: string} | undefined;
  loadTrack: (coachId: string, id: string) => Promise<SpeechMouthTrack | undefined>;
};
type Collection = "opening" | "all";

/** Compare the same supported meaning in complete, already recorded coach banks. */
export default function RecordedCoachComparison({player, catalog}: {player: StudioPlayer; catalog: RecordedCoachCatalog}) {
  const id = useId();
  const [collection, setCollection] = useState<Collection>("opening");
  const [coachId, setCoachId] = useState(catalog.coaches[0]);
  const [meaningId, setMeaningId] = useState<string>();
  const [motion, setMotion] = useState<MotionPreference>("system");
  const coaches = catalog.coaches.map(getCoach);
  const coach = coaches.find(item => item.id === coachId) ?? coaches[0];
  const meanings = catalog.meanings.filter(meaning => collection === "all" || meaning.id.startsWith("book-opening-"));
  const meaning = meanings.find(item => item.id === meaningId) ?? meanings[0];
  const recording = coach && meaning ? catalog.recording(coach.id, meaning.id) : undefined;
  const clipKey = `${coach?.id ?? ""}:${meaning?.id ?? ""}:${recording?.url ?? ""}`;
  const [loaded, setLoaded] = useState<{key: string; track?: SpeechMouthTrack}>();
  useEffect(() => {
    if (coaches.length < 2 || !coach || !meaning || !recording) return;
    let current = true;
    void catalog.loadTrack(coach.id, meaning.id).then(track => {
      if (current) setLoaded({key: clipKey, track});
    }, () => {if (current) setLoaded({key: clipKey});});
    return () => {current = false;};
  }, [catalog, coaches.length, coach?.id, meaning?.id, recording?.url, clipKey]);
  if (coaches.length < 2) return null;

  const track = loaded?.key === clipKey ? loaded.track : undefined;
  const voiceId = `recorded-coach-comparison:${coach.id}`;
  const current = player.speechPlayback.voiceId === voiceId && player.speechPlayback.scriptId === meaning?.id;
  const playing = current && player.speechPlayback.state === "playing";
  const speech = playing && player.speaking?.eventId === player.speechPlayback.eventId ? player.speaking ?? undefined : undefined;
  const categories = [...new Set(meanings.map(item => item.group))];
  function play(inContext: boolean) {
    if (!recording || !track || !meaning) return;
    const utterance: CoachUtterance = {
      version: "coach-utterance-1", id: `development:recorded-coach:${clipKey}`,
      intentId: `development:recorded-meaning:${meaning.id}`, coachId: coach.id,
      text: recording.text, speechText: recording.text, expression: "explaining",
      intensity: .4, priority: 50, interruptible: true, autoSpeakSuitable: false,
      trace: {renderer: "development-recorded-coach-comparison", variants: [], decisions: [
        "Manual playback of one complete recording for this coach and supported meaning.",
        "This preview does not change casting choices or account preferences.",
      ]},
    };
    void player.playSpeech({url: recording.url, recordingId: recording.id, voiceId,
      voiceName: meaning.label, scriptId: meaning.id, coachName: coach.name, utterance}, inContext);
  }
  return <section className="voice-audition recorded-coach-comparison" aria-labelledby={`${id}-heading`}
    data-playback={current ? player.speechPlayback.state : "idle"}>
    <header className="voice-audition-heading">
      <h2 id={`${id}-heading`}>Recorded coach comparison</h2>
      <p>One meaning, different characters. Compare their finished lines and mouth movements.</p>
    </header>
    <div className="voice-audition-layout">
      <div className="voice-audition-controls voice-audition-fields">
        <ChoiceGroup label="Recording collection" value={collection}
          options={[{value: "opening", label: "Opening run"}, {value: "all", label: "All lines"}]}
          onChange={next => {if (next !== collection) {player.stop(); setCollection(next);}}} />
        {meaning && <label>Spoken meaning<select value={meaning.id} onChange={event => {player.stop(); setMeaningId(event.target.value);}}>
          {categories.map(category => <optgroup key={category} label={category}>
            {meanings.filter(item => item.group === category).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </optgroup>)}
        </select></label>}
        <ChoiceGroup label="Recorded coach" value={coach.id} options={coaches.map(item => ({value: item.id, label: item.name}))}
          onChange={next => {if (next !== coach.id) {player.stop(); setCoachId(next);}}} />
        <MotionSelect id={`${id}-motion`} label="Comparison motion" value={motion} onChange={setMotion} />
        {meaning && <details className="disclosure voice-audition-texts">
          <summary>Compare the wording</summary>
          <dl>{coaches.map(item => <div key={item.id}><dt>{item.name}</dt>
            <dd>{catalog.recording(item.id, meaning.id)?.text ?? "This recording is not available yet."}</dd></div>)}</dl>
        </details>}
      </div>
      <div className="voice-audition-preview">
        {meaning ? <>
          <ReviewCoach title={<strong>{meaning.label}</strong>} portraitCaption={coach.name} messageResetKey={clipKey}
            character={<CoachCharacter coach={coach} motion={motion}
              reaction={{state: playing ? "explaining" : "neutral", key: playing ? player.speechPlayback.eventId! : "recorded-comparison-ready"}}
              speech={speech} speechTrack={track} label={`${coach.name}, recorded voice comparison`} />}
            actions={<>
              <Button variant="primary" aria-label={`Play ${coach.name} recording`} disabled={!recording || !track} onClick={() => play(false)}><Play size={15} aria-hidden="true" />Play {coach.name}</Button>
              <Button aria-label={`${coach.name} recording in context`} disabled={!recording || !track} onClick={() => play(true)}>In context</Button>
            </>}><p>{recording?.text ?? "This recording is not available yet."}</p></ReviewCoach>
          {(!recording || !track) && <Notice announcement="status" appearance="inline">
            {!recording || loaded?.key === clipKey ? "This recording and its mouth timing are still being prepared." : "Loading mouth timing…"}
          </Notice>}
        </> : <Notice announcement="status">No recordings in this collection yet. Choose another collection.</Notice>}
      </div>
    </div>
  </section>;
}
