import Button from "./Button";
import { useState } from "react";
import { useCoachPreferences } from "./coach/CoachProvider";
import { useMotionPreferences } from "./MotionProvider";
import MotionSelect from "./MotionSelect";
import SettingsSection from "./SettingsSection";
import { useReducedMotion } from "./useReducedMotion";

function CoachMotionSetting() {
  const {preferences, ready, saving, error, save, retry} = useCoachPreferences();
  const reduced = useReducedMotion();
  const [saved, setSaved] = useState(false);
  return <div className="motion-preference">
    <MotionSelect id="coach-motion" label="Coach motion" describedBy="motion-settings-help"
      value={preferences.motion} disabled={!ready || saving}
      onChange={async motion => {
        setSaved(false);
        setSaved(await save({...preferences, motion}));
      }} />
    <div className="coach-motion-preference-status" role="status" aria-atomic="true">
      {saving ? "Saving…" : error ? <>
        {error}{" "}<Button size="compact" variant="quiet" onClick={retry}>Reload coach motion preferences</Button>
      </> : !ready ? "Loading…"
        : saved ? "Saved"
        : preferences.motion === "system" && reduced
          ? "Still · device setting" : null}
    </div>
  </div>;
}

export default function MotionSettings() {
  const {preferences, ready, saving, error, save, retry} = useMotionPreferences();
  const reduced = useReducedMotion();
  const [saved, setSaved] = useState(false);
  return <SettingsSection id="motion-settings" title="Animations"
    description={<span id="motion-settings-help">Follow your browser’s motion preference by default, or choose Animated or Still for each control.</span>}>
    <div className="motion-controls">
      <CoachMotionSetting />
      <div className="motion-preference">
        <MotionSelect id="interface-motion" label="Piece & interface motion" describedBy="motion-settings-help"
          value={preferences.motion} disabled={!ready || saving}
          onChange={async motion => {
            setSaved(false);
            setSaved(await save({motion}));
          }} />
        <div className="motion-preference-status" role="status" aria-atomic="true">
          {saving ? "Saving…" : error ? <>
            {error}{" "}<Button size="compact" variant="quiet" onClick={retry}>Reload motion preferences</Button>
          </> : !ready ? "Loading…"
            : saved ? "Saved"
            : preferences.motion === "system" && reduced
              ? "Still · device setting" : null}
        </div>
      </div>
    </div>
  </SettingsSection>;
}
