import { useEffect, useId, useState } from "react";
import { Play } from "lucide-react";
import Button from "../../Button";
import ChoiceGroup from "../../ChoiceGroup";
import MotionSelect from "../../MotionSelect";
import ReviewCoach from "../../ReviewCoach";
import SourceLine from "../../SourceLine";
import type { MotionPreference } from "../../motion";
import { CoachCharacter } from "../../coach/CoachAvatar";
import type { CoachExpression, CoachMotion } from "../../coach/model";
import { coachGroups } from "../../coach/registry";
import type { SpeechMouthTrack } from "../../coach/speechMouth";
import { castAuditionCoaches, castAuditionUtterance, castMouthTrack, castRecording } from "../speech/castAuditions";
import type { StudioPlayer } from "./useStudioPlayer";
import CastingChoice from "./CastingChoice";
import CastingProgress from "./CastingProgress";
import {useCastingChoices, type CastingRecording} from "./useCastingChoices";
import "../../coach-presentation.css";
import "../../disclosure.css";
import "./voice-audition.css";
import "./cast-audition.css";

function matchesRecording(recording: ReturnType<typeof castRecording>, registered: CastingRecording | undefined) {
  return !!recording && registered?.id === recording.id && registered.generatedVoiceId === recording.generatedVoiceId &&
    registered.audioSha256 === recording.audioSha256;
}

/** Same audition panel in Audio Studio and the selected Coach Studio inspector. */
export default function CastVoiceAudition({player, coachId, expression = "explaining", motion: externalMotion}: {
  player: StudioPlayer; coachId?: string; expression?: CoachExpression; motion?: CoachMotion;
}) {
  const id = useId();
  const choices = useCastingChoices();
  const [selectedCoachId, setSelectedCoachId] = useState<string>();
  const [filter, setFilter] = useState<"pending" | "locked">("pending");
  // Explicit listening wins over a late server response; only an untouched picker
  // adopts the first pending coach when the durable approvals arrive.
  const effectiveFilter = selectedCoachId ? choices.locks[selectedCoachId] ? "locked" : "pending" : filter;
  const visibleCoaches = castAuditionCoaches.filter(item => !!choices.locks[item.coachId] === (effectiveFilter === "locked"));
  const candidate = castAuditionCoaches.find(item => item.coachId === (coachId ?? selectedCoachId ?? visibleCoaches[0]?.coachId));
  const [directionId, setDirectionId] = useState<string>();
  const savedDirection = candidate && (choices.locks[candidate.coachId]?.directionId ?? choices.choices[candidate.coachId]?.directionId);
  const direction = candidate?.directions.find(item => item.id === (directionId ?? savedDirection)) ?? candidate?.directions[0];
  const recording = candidate && direction && castRecording(candidate.coachId, direction.id);
  const recordingId = recording?.id;
  const [alignment, setAlignment] = useState<{id: string; track?: SpeechMouthTrack}>();
  const [motion, setMotion] = useState<MotionPreference>("system");
  useEffect(() => {
    if (!recordingId) return;
    let current = true;
    void castMouthTrack(recordingId).then(track => {
      if (current) setAlignment({id: recordingId, track});
    }, () => {
      if (current) setAlignment({id: recordingId});
    });
    return () => { current = false; };
  }, [recordingId]);
  function selectCoach(next: string) {
    player.stop(); setSelectedCoachId(next); setDirectionId(undefined);
  }
  const navigation = <>
    <CastingProgress choices={choices} onCoach={!coachId ? selectCoach : undefined} />
    {!coachId && <ChoiceGroup label="Casting collection" value={effectiveFilter}
      options={[{value: "pending", label: "Needs a voice"}, {value: "locked", label: "Locked voices"}]}
      onChange={next => {player.stop(); setFilter(next); setSelectedCoachId(undefined); setDirectionId(undefined);}} />}
  </>;
  const heading = <header className="voice-audition-heading cast-audition-heading">
    <h2 id={`${id}-heading`}>Cast voice auditions</h2>
    <p>Listen to each direction, then choose a favorite or tell us to keep looking.</p>
  </header>;
  if (!candidate || !direction) return <section className="voice-audition cast-audition" aria-labelledby={`${id}-heading`}>
    {heading}{navigation}
    <p role="status">{coachId ? "No voice auditions are available for this coach yet." : effectiveFilter === "pending" ?
      "Every coach has a locked voice. You can inspect them under Locked voices." : "No voices are locked yet."}</p>
  </section>;

  const {coach} = candidate;
  const track = alignment?.id === recordingId ? alignment?.track : undefined;
  const ready = !!recording && !!track;
  const registered = choices.candidates[coach.id]?.[direction.id];
  const sameRecording = matchesRecording(recording, registered);
  const registeredSet = choices.candidates[coach.id] ?? {};
  const sameCandidateSet = !!choices.candidateSetFingerprints[coach.id] &&
    Object.keys(registeredSet).length === candidate.directions.length &&
    candidate.directions.every(item => matchesRecording(castRecording(coach.id, item.id), registeredSet[item.id]));
  const current = player.speechPlayback.coachId === coach.id && player.speechPlayback.voiceId === direction.id;
  const playing = current && player.speechPlayback.state === "playing";
  const speech = playing && player.speaking?.eventId === player.speechPlayback.eventId ? player.speaking ?? undefined : undefined;
  const reaction = {state: playing ? expression : "neutral" as const, key: playing ? player.speechPlayback.eventId! : `cast-ready:${coach.id}`};
  function play(inContext: boolean) {
    if (!recording || !track) return;
    // A late saved-choice load must not switch a preview the listener just started.
    if (!coachId) setSelectedCoachId(coach.id);
    setDirectionId(direction!.id);
    void player.playSpeech({url: recording.url, recordingId: recording.id, voiceId: direction!.id,
      voiceName: direction!.label, scriptId: recording.id, coachName: coach.name,
      utterance: castAuditionUtterance(recording, expression)}, inContext);
  }
  return <section className="voice-audition cast-audition" aria-labelledby={`${id}-heading`} data-playback={current ? player.speechPlayback.state : "idle"}>
    {heading}{navigation}
    <div className="voice-audition-layout cast-audition-layout">
      <div className="voice-audition-controls cast-audition-controls">
        {!coachId && <label>Cast coach<select value={coach.id} onChange={event => selectCoach(event.target.value)}>
          {coachGroups.map(group => {
            const members = visibleCoaches.filter(item => item.coach.group === group.id);
            return members.length ? <optgroup key={group.id} label={group.label}>
              {members.map(item => <option key={item.coachId} value={item.coachId}>{item.coach.name}</option>)}
            </optgroup> : null;
          })}
        </select></label>}
        <label>Candidate direction<select value={direction.id} onChange={event => {
          player.stop(); if (!coachId) setSelectedCoachId(coach.id); setDirectionId(event.target.value);
        }}>
          {candidate.directions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select></label>
        {externalMotion === undefined && <MotionSelect id={`${id}-motion`} label="Candidate motion" value={motion} onChange={setMotion} />}
        <p className="cast-audition-note">In context plays a piece move first. Still keeps the portrait static while the recording plays.</p>
        <details className="disclosure">
          <summary>Voice direction and source</summary>
          <p>{direction.prompt}</p>
          <SourceLine text="Custom ElevenLabs Voice Design preview. Local playback; no provider request or account changes."
            url="https://elevenlabs.io/voice-design" linkLabel="Voice provider" />
        </details>
      </div>
      <div className="voice-audition-preview cast-audition-preview">
        <ReviewCoach title={<strong>{direction.label}</strong>} portraitCaption={coach.name} messageResetKey={recordingId ?? direction.id}
          character={<CoachCharacter coach={coach} reaction={reaction} motion={externalMotion ?? motion} speech={speech} speechTrack={track}
            label={`${coach.name}, candidate voice preview`} />}
          actions={<>
            <Button variant="primary" aria-label="Play candidate" disabled={!ready} onClick={() => play(false)}><Play size={15} aria-hidden="true" />Play voice</Button>
            <Button aria-label="Candidate in context" disabled={!ready} onClick={() => play(true)}>In context</Button>
          </>}>
          <p>{candidate.text}</p>
        </ReviewCoach>
        {!ready && <p role="status" className="cast-audition-note">{!recording ? "Awaiting this candidate’s recording." :
          alignment?.id === recordingId ? "Mouth timing is unavailable for this recording." : "Loading mouth timing…"}</p>}
        {ready && <p className="cast-audition-note">{recording.durationSeconds.toFixed(1)} seconds · Automatically aligned mouth timing</p>}
        {choices.ready && recording && !sameRecording && <p className="cast-audition-note" role="status">
          This preview differs from the studio’s current recording. Reload the page before choosing it.
        </p>}
        {choices.ready && !choices.locks[coach.id] && sameRecording && !sameCandidateSet && <p className="cast-audition-note" role="status">
          {choices.candidateSetFingerprints[coach.id] ? "Some auditions have changed. Reload the page before deciding about this set." :
            "This audition round is still being prepared. Keep looking will be available when every candidate is ready."}
        </p>}
        <CastingChoice key={coach.id} coachId={coach.id} coachName={coach.name} direction={direction}
          directions={candidate.directions} available={ready && sameRecording} setAvailable={sameCandidateSet} choices={choices} />
      </div>
    </div>
  </section>;
}
