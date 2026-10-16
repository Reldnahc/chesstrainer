import {useEffect, useId, useState} from "react";
import ChoiceGroup from "../../ChoiceGroup";
import MotionSelect from "../../MotionSelect";
import Notice from "../../Notice";
import {getCoach} from "../../coach/registry";
import type {SpeechMouthTrack} from "../../coach/speechMouth";
import type {MotionPreference} from "../../motion";
import type {StudioPlayer} from "./useStudioPlayer";
import {GroupedSelect, StudioCoachPreview, StudioReviewPanel, studioSpeech} from "./StudioReviewPanel";

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
  // A sequenced recording is a fresh object each render; reload only when the clip changes.
  const clipCoachId = coach?.id;
  const clipMeaningId = meaning?.id;
  const clipUrl = recording?.url;
  useEffect(() => {
    if (coaches.length < 2 || clipCoachId === undefined || clipMeaningId === undefined || clipUrl === undefined) return;
    let current = true;
    void catalog.loadTrack(clipCoachId, clipMeaningId).then(track => {
      if (current) setLoaded({key: clipKey, track});
    }, () => {if (current) setLoaded({key: clipKey});});
    return () => {current = false;};
  }, [catalog, coaches.length, clipCoachId, clipMeaningId, clipUrl, clipKey]);
  if (coaches.length < 2) return null;

  const track = loaded?.key === clipKey ? loaded.track : undefined;
  const voiceId = `recorded-coach-comparison:${coach.id}`;
  const {current, playing, speech} = studioSpeech(player, voiceId, meaning?.id);
  function play(inContext: boolean) {
    if (!recording || !track || !meaning) return;
    // Manual playback of one complete recording; it changes no casting choice or preference.
    const utterance = {id: `development:recorded-coach:${clipKey}`, coachId: coach.id, priority: 50, interruptible: true};
    void player.playSpeech({url: recording.url, recordingId: recording.id, voiceId,
      voiceName: meaning.label, scriptId: meaning.id, coachName: coach.name, utterance}, inContext);
  }
  return <StudioReviewPanel id={id} className="recorded-coach-comparison" playback={current ? player.speechPlayback.state : "idle"}
    title="Recorded coach comparison"
    description="One meaning, different characters. Compare their finished lines and mouth movements."
    controls={<>
      <ChoiceGroup label="Recording collection" value={collection}
        options={[{value: "opening", label: "Opening run"}, {value: "all", label: "All lines"}]}
        onChange={next => {if (next !== collection) {player.stop(); setCollection(next);}}} />
      {meaning && <GroupedSelect label="Spoken meaning" value={meaning.id} items={meanings} group={item => item.group}
        onChange={next => {player.stop(); setMeaningId(next);}} />}
      <ChoiceGroup label="Recorded coach" value={coach.id} options={coaches.map(item => ({value: item.id, label: item.name}))}
        onChange={next => {if (next !== coach.id) {player.stop(); setCoachId(next);}}} />
      <MotionSelect id={`${id}-motion`} label="Comparison motion" value={motion} onChange={setMotion} />
      {meaning && <details className="disclosure voice-audition-texts">
        <summary>Compare the wording</summary>
        <dl>{coaches.map(item => <div key={item.id}><dt>{item.name}</dt>
          <dd>{catalog.recording(item.id, meaning.id)?.text ?? "This recording is not available yet."}</dd></div>)}</dl>
      </details>}
    </>}
    preview={meaning ? <>
      <StudioCoachPreview coach={coach} motion={motion} playing={playing} eventId={player.speechPlayback.eventId}
        readyKey="recorded-comparison-ready" speech={speech} track={track} label={`${coach.name}, recorded voice comparison`}
        title={<strong>{meaning.label}</strong>} resetKey={clipKey}
        playLabel={`Play ${coach.name} recording`} playText={`Play ${coach.name}`} contextLabel={`${coach.name} recording in context`}
        disabled={!recording || !track} onPlay={play}><p>{recording?.text ?? "This recording is not available yet."}</p></StudioCoachPreview>
      {(!recording || !track) && <Notice announcement="status" appearance="inline">
        {!recording || loaded?.key === clipKey ? "This recording and its mouth timing are still being prepared." : "Loading mouth timing…"}
      </Notice>}
    </> : <Notice announcement="status">No recordings in this collection yet. Choose another collection.</Notice>} />;
}
