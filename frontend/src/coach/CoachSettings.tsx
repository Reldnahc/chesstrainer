import PreferenceStatus from "../PreferenceStatus";
import { useEffect, useRef, useState } from "react";
import SettingsSection from "../SettingsSection";
import { useCoachSpeech } from "../audio/speech/useCoachSpeech";
import { COACH_INTRODUCTION } from "../audio/speech/voiceBank";
import { CoachCharacter } from "./CoachAvatar";
import { useCoachPreference, useCoachPreferences } from "./CoachProvider";
import { getCoach, selectableCoaches } from "./registry";
import type { CoachId } from "./model";
import "./settings.css";

export default function CoachSettings() {
  const choice = useCoachPreference("coach_id");
  const { value: motion } = useCoachPreference("motion");
  const { ready, saving, error, retry } = choice;
  const savedCoachId = useCoachPreferences().preferences.coach_id;
  const [saved, setSaved] = useState(false);
  // A new choice shows as selected at once and the picker stays enabled while it saves.
  const selected = getCoach(choice.value);
  // Choosing a coach plays its introduction once the choice is saved. A coach
  // without a recorded introduction stays silent; voice Off or mute also wins.
  const voice = useCoachSpeech({ scopeKey: "settings:coach-introduction",
    manualRecordingIds: [COACH_INTRODUCTION] });
  const requested = useRef<CoachId | null>(null);
  const [introduce, setIntroduce] = useState<CoachId | null>(null);
  async function change(value: CoachId) {
    requested.current = value;
    setIntroduce(null);
    voice.stop();
    setSaved(false);
    const ok = await choice.save(value);
    setSaved(ok);
    if (ok && requested.current === value) setIntroduce(value);
  }
  const { play } = voice;
  useEffect(() => {
    if (!introduce || savedCoachId !== introduce) return;
    setIntroduce(null);
    void play(COACH_INTRODUCTION);
  }, [introduce, savedCoachId, play]);
  return (
    <SettingsSection
      id="coach-settings"
      title="Your coach"
      className="coach-settings"
      description={<><strong>{selected.name}:</strong> {selected.description}</>}
      actions={
        <PreferenceStatus className="coach-preference-status" placement="heading"
          ready={ready} saving={saving} error={error} saved={saved}
          retry={retry} retryLabel="Reload preferences" />
      }
    >
      <fieldset disabled={!ready} className="coach-options">
        <legend className="sr-only">Choose your coach</legend>
        {selectableCoaches.map((coach) => (
            <label
              key={coach.id}
              className="coach-option"
              title={coach.description}
            >
              <CoachCharacter
                coach={coach}
                reaction={{ state: "neutral", key: "settings" }}
                motion={
                  ready && selected.id === coach.id
                    ? motion
                    : "still"
                }
                idle={selected.id === coach.id}
                label={`${coach.name} portrait`}
                speech={selected.id === coach.id ? voice.speech : undefined}
                speechTrack={selected.id === coach.id ? voice.speechTrack : undefined}
              />
              <strong>{coach.name}</strong>
              <span className="coach-option-description sr-only" id={`coach-description-${coach.id}`}>
                {coach.description}
              </span>
              <input
                type="radio"
                name="coach"
                aria-label={coach.name}
                aria-describedby={`coach-description-${coach.id}`}
                value={coach.id}
                checked={selected.id === coach.id}
                onChange={() => change(coach.id)}
              />
            </label>
        ))}
      </fieldset>
    </SettingsSection>
  );
}
