import { useState } from "react";
import { CoachCharacter } from "./CoachAvatar";
import { useCoachPreferences } from "./CoachProvider";
import { getCoach, selectableCoaches } from "./registry";
import type { CoachPreferences } from "./model";
import "./settings.css";

export default function CoachSettings() {
  const { preferences, ready, saving, error, save, retry } =
    useCoachPreferences();
  const [saved, setSaved] = useState(false);
  const selected = getCoach(preferences.coach_id);
  async function change(value: CoachPreferences) {
    setSaved(false);
    setSaved(await save(value));
  }
  return (
    <section
      className="panel coach-settings"
      aria-labelledby="coach-settings-title"
    >
      <div className="coach-settings-heading">
        <div>
          <h2 id="coach-settings-title">Your coach</h2>
          <p>
            <strong>{selected.name}</strong> joins you in game review and
            practice.
          </p>
        </div>
      </div>
      <p className="coach-preference-status" role="status">
        {saving ? (
          "Saving…"
        ) : error ? (
          <>
            {error}{" "}
            <button className="text-button" onClick={retry}>
              Reload preferences
            </button>
          </>
        ) : !ready ? (
          "Loading your coach…"
        ) : saved ? (
          "Saved. This choice follows your account."
        ) : (
          "Your coach is saved with your workspace."
        )}
      </p>
      <fieldset disabled={!ready || saving} className="coach-options">
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
                    ? preferences.motion
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
                onChange={() =>
                  change({
                    ...preferences,
                    coach_id: coach.id,
                  })
                }
              />
            </label>
        ))}
      </fieldset>
    </section>
  );
}
