import { useState } from "react";
import Link from "../Link";
import { CoachCharacter } from "./CoachAvatar";
import { useCoachPreferences } from "./CoachProvider";
import { getCoach, selectableCoaches } from "./registry";
import type { CoachMotion, CoachPreferences } from "./model";
import { useReducedMotion } from "./usePerformance";
import "./settings.css";

export default function CoachSettings() {
  const { preferences, ready, saving, error, save, retry } =
    useCoachPreferences();
  const reduced = useReducedMotion();
  const [saved, setSaved] = useState(false);
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
          <p>A familiar face for your games and practice.</p>
        </div>
        <Link className="text-button" href="/coach-studio">
          Preview expressions <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <fieldset disabled={!ready || saving} className="coach-options">
        <legend className="sr-only">Choose your coach</legend>
        {selectableCoaches.map((coach) => (
          <label key={coach.id} className="coach-option">
            <CoachCharacter
              coach={getCoach(coach.id)}
              reaction={{ state: "neutral", key: "settings" }}
              motion={ready ? preferences.motion : "still"}
            />
            <span>
              <strong>{coach.name}</strong>
              <span>{coach.description}</span>
            </span>
            <input
              type="radio"
              name="coach"
              value={coach.id}
              checked={preferences.coach_id === coach.id}
              onChange={() =>
                change({
                  ...preferences,
                  coach_id: coach.id as CoachPreferences["coach_id"],
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
