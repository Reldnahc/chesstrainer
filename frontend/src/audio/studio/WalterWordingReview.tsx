import { useEffect, useId, useState } from "react";
import ChoiceGroup from "../../ChoiceGroup";
import MotionSelect from "../../MotionSelect";
import { getCoach } from "../../coach/registry";
import type { SpeechMouthTrack } from "../../coach/speechMouth";
import type { MotionPreference } from "../../motion";
import type { StudioPlayer } from "./useStudioPlayer";
import { GroupedSelect, StudioCoachPreview, StudioReviewPanel, studioSpeech } from "./StudioReviewPanel";
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
  const exampleKey = example?.id;
  useEffect(() => {
    if (exampleKey === undefined) return;
    let current = true;
    void catalog.loadClip(exampleKey, version).then(clip => {
      if (current) setLoaded({key: clipKey, clip});
    }, () => {if (current) setLoaded({key: clipKey});});
    return () => {current = false;};
  }, [catalog, exampleKey, version, clipKey]);
  if (!example) return null;

  const clip = loaded?.key === clipKey ? loaded.clip : undefined;
  const voiceId = `walter-wording-${version}`;
  const {current, playing, speech} = studioSpeech(player, voiceId, example.id);
  const text = version === "original" ? example.previousText : example.text;
  function play(inContext: boolean) {
    if (!clip || !example) return;
    // Manual comparison in Walter's locked voice; it changes no analysis, casting choice or preference.
    const utterance = {id: `development:walter-wording:${clipKey}`, coachId: walter.id, priority: 50, interruptible: true};
    void player.playSpeech({url: clip.url, recordingId: clip.id, voiceId,
      voiceName: version === "original" ? "Original wording" : "Revised wording",
      scriptId: example.id, coachName: walter.name, utterance}, inContext);
  }
  return <StudioReviewPanel id={id} className="walter-wording" playback={current ? player.speechPlayback.state : "idle"}
    title="Walter wording"
    description="The same Walter voice, with clearer explanations. Compare the original and revised recordings."
    controls={<>
      <ChoiceGroup label="Example collection" value={collection}
        options={[{value: "featured", label: "A few examples"}, {value: "all", label: "All revised clips"}]}
        onChange={next => {if (next !== collection) {player.stop(); setCollection(next);}}} />
      <GroupedSelect label="Wording example" value={example.id} items={examples} group={item => item.category}
        onChange={next => {player.stop(); setExampleId(next);}} />
      <ChoiceGroup label="Wording version" value={version}
        options={[{value: "original", label: "Original"}, {value: "revised", label: "Revised"}]}
        onChange={next => {if (next !== version) {player.stop(); setVersion(next);}}} />
      <MotionSelect id={`${id}-motion`} label="Walter motion" value={motion} onChange={setMotion} />
      <p className="voice-audition-note">{example.reason}</p>
      <details className="disclosure voice-audition-texts">
        <summary>Compare the text</summary>
        <dl><dt>Original</dt><dd>{example.previousText}</dd><dt>Revised</dt><dd>{example.text}</dd></dl>
      </details>
    </>}
    preview={<>
      <StudioCoachPreview coach={walter} motion={motion} playing={playing} eventId={player.speechPlayback.eventId}
        readyKey="walter-wording-ready" speech={speech} track={clip?.track} label="Walter, wording comparison"
        title={<strong>{version === "original" ? "Original" : "Revised"} · {example.label}</strong>} resetKey={clipKey}
        playLabel={`Play ${version} Walter wording`} playText={`Play ${version}`} contextLabel="Walter wording in context"
        disabled={!clip} onPlay={play}><p>{text}</p></StudioCoachPreview>
      {!clip && <p className="walter-wording-status" role="status">{loaded?.key === clipKey ?
        "This recording and its mouth timing are still being prepared." : "Loading recording details…"}</p>}
    </>} />;
}
