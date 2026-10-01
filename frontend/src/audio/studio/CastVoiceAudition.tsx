import { useEffect, useId, useState } from "react";
import { Play } from "lucide-react";
import Button from "../../Button";
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
import "../../coach-presentation.css";
import "../../disclosure.css";
import "./voice-audition.css";
import "./cast-audition.css";

/** Same audition panel in Audio Studio and the selected Coach Studio inspector. */
export default function CastVoiceAudition({player, coachId, expression = "explaining", motion: externalMotion}: {
  player: StudioPlayer; coachId?: string; expression?: CoachExpression; motion?: CoachMotion;
}) {
  const id = useId();
  const [selectedCoachId, setSelectedCoachId] = useState(castAuditionCoaches[0]?.coachId);
  const candidate = castAuditionCoaches.find(item => item.coachId === (coachId ?? selectedCoachId));
  const [directionId, setDirectionId] = useState<string>();
  const direction = candidate?.directions.find(item => item.id === directionId) ?? candidate?.directions[0];
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
  if (!candidate || !direction) return <p role="status">No voice auditions are available for this coach yet.</p>;

  const {coach} = candidate;
  const track = alignment?.id === recordingId ? alignment?.track : undefined;
  const ready = !!recording && !!track;
  const current = player.speechPlayback.coachId === coach.id && player.speechPlayback.voiceId === direction.id;
  const playing = current && player.speechPlayback.state === "playing";
  const speech = playing && player.speaking?.eventId === player.speechPlayback.eventId ? player.speaking ?? undefined : undefined;
  const reaction = {state: playing ? expression : "neutral" as const, key: playing ? player.speechPlayback.eventId! : `cast-ready:${coach.id}`};
  function play(inContext: boolean) {
    if (!recording || !track) return;
    void player.playSpeech({url: recording.url, recordingId: recording.id, voiceId: direction!.id,
      voiceName: direction!.label, scriptId: recording.id, coachName: coach.name,
      utterance: castAuditionUtterance(recording, expression)}, inContext);
  }
  return <section className="voice-audition cast-audition" aria-labelledby={`${id}-heading`} data-playback={current ? player.speechPlayback.state : "idle"}>
    <header className="voice-audition-heading cast-audition-heading">
      <h2 id={`${id}-heading`}>Cast voice auditions</h2>
      <p>Three distinct directions for each character. Compare the same short teaching example; these voices are not selected for the application.</p>
    </header>
    <div className="voice-audition-layout cast-audition-layout">
      <div className="voice-audition-controls cast-audition-controls">
        {!coachId && <label>Cast coach<select value={coach.id} onChange={event => {
          player.stop(); setSelectedCoachId(event.target.value); setDirectionId(undefined);
        }}>
          {coachGroups.map(group => {
            const members = castAuditionCoaches.filter(item => item.coach.group === group.id);
            return members.length ? <optgroup key={group.id} label={group.label}>
              {members.map(item => <option key={item.coachId} value={item.coachId}>{item.coach.name}</option>)}
            </optgroup> : null;
          })}
        </select></label>}
        <label>Candidate direction<select value={direction.id} onChange={event => {player.stop(); setDirectionId(event.target.value);}}>
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
      </div>
    </div>
  </section>;
}
