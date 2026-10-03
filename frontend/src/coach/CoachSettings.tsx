import PreferenceStatus from "../PreferenceStatus";
import { useState } from "react";
import SettingsSection from "../SettingsSection";
import { CoachCharacter } from "./CoachAvatar";
import { useCoachPreference } from "./CoachProvider";
import { getCoach, selectableCoaches } from "./registry";
import type { CoachId } from "./model";
import "./settings.css";

export default function CoachSettings() {
  const choice = useCoachPreference("coach_id");
  const { value: motion } = useCoachPreference("motion");
  const { ready, saving, error, retry } = choice;
  const [saved, setSaved] = useState(false);
  // A new choice shows as selected at once and the picker stays enabled while it saves.
  const selected = getCoach(choice.value);
  async function change(value: CoachId) {
    setSaved(false);
    setSaved(await choice.save(value));
  }
  return (
    <SettingsSection
      id="coach-settings"
      title="Your coach"
      className="coach-settings"
      description={`${selected.name} joins you in game review and practice.`}
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
