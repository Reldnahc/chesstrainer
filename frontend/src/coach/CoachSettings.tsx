import { useState } from "react";
import { CoachCharacter } from "./CoachAvatar";
import { useCoachPreferences } from "./CoachProvider";
import { coachCollections, getCoach, selectableCoaches } from "./registry";
import type { CoachId, CoachMotion, CoachPreferences } from "./model";
import { useReducedMotion } from "./useReducedMotion";
import "./settings.css";

export default function CoachSettings() {
  const { preferences, ready, saving, error, save, retry } =
    useCoachPreferences();
  const reduced = useReducedMotion();
  const [saved, setSaved] = useState(false);
  const selected = getCoach(preferences.coach_id);
  const [browsing, setBrowsing] = useState<{
    forCoach: CoachId;
    collection: string;
  }>();
  // Follow a restored account choice, without making browsing a preference write.
  const collection =
    browsing?.forCoach === selected.id
      ? browsing.collection
      : selected.collectionId;
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
      <div
        className="coach-collections"
        role="group"
        aria-label="Coach collections"
      >
        {coachCollections.map((group) => (
          <button
            key={group.id}
            type="button"
            disabled={!ready || saving}
            aria-pressed={collection === group.id}
            onClick={() =>
              setBrowsing({ forCoach: selected.id, collection: group.id })
            }
          >
            {group.name}
          </button>
        ))}
      </div>
      <fieldset disabled={!ready || saving} className="coach-options">
        <legend className="sr-only">Choose your coach</legend>
        {selectableCoaches
          .filter((coach) => coach.collectionId === collection)
          .map((coach) => (
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
              <input
                type="radio"
                name="coach"
                aria-label={coach.name}
                value={coach.id}
                checked={preferences.coach_id === coach.id}
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
      <div className="coach-motion-setting">
        <div>
          <label htmlFor="coach-motion">Coach motion</label>
          <span id="coach-motion-help">
            Reactions stay expressive even when motion is off.
          </span>
        </div>
        <select
          id="coach-motion"
          aria-describedby="coach-motion-help"
          disabled={!ready || saving}
          value={preferences.motion}
          onChange={(event) =>
            change({
              ...preferences,
              motion: event.target.value as CoachMotion,
            })
          }
        >
          <option value="natural">Natural</option>
          <option value="subtle">Subtle</option>
          <option value="still">Still</option>
        </select>
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
        ) : reduced ? (
          "Your device requests reduced motion. The coach will stay still."
        ) : saved ? (
          "Saved. This choice follows your account."
        ) : (
          "Your coach and motion preference are saved with your workspace."
        )}
      </p>
    </section>
  );
}
