import { useCoachPreferences } from "./CoachProvider";
import type { SpeechPlayback } from "../audio/model";
import { getCoach } from "./registry";
import type { CoachReaction } from "./model";
import type { SpeechMouthTrack } from "./speechMouth";
import { CoachCharacter } from "./CoachCharacter";

/** The learner's chosen coach, at their saved motion setting. */
export default function CoachAvatar({ reaction, speech, speechTrack }: { reaction: CoachReaction; speech?: SpeechPlayback; speechTrack?: SpeechMouthTrack }) {
  const { preferences, ready } = useCoachPreferences();
  return (
    <CoachCharacter
      coach={getCoach(preferences.coach_id)}
      reaction={reaction}
      motion={ready ? preferences.motion : "still"}
      speech={speech}
      speechTrack={speechTrack}
    />
  );
}
