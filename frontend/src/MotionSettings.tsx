import PreferenceStatus from "./PreferenceStatus";
import { useState } from "react";
import { useCoachPreference } from "./coach/CoachProvider";
import { useMotionPreferences } from "./MotionProvider";
import MotionSelect from "./MotionSelect";
import SettingsSection from "./SettingsSection";
import { useReducedMotion } from "./useReducedMotion";

function CoachMotionSetting() {
  const {value, ready, saving, error, save, retry} = useCoachPreference("motion");
  const reduced = useReducedMotion();
  const [saved, setSaved] = useState(false);
  return <div className="motion-preference">
    <MotionSelect id="coach-motion" label="Coach motion" describedBy="motion-settings-help"
      value={value} disabled={!ready || saving}
      onChange={async motion => {
        setSaved(false);
        setSaved(await save(motion));
      }} />
    <PreferenceStatus className="coach-motion-preference-status"
      ready={ready} saving={saving} error={error} saved={saved}
      retry={retry} retryLabel="Reload coach motion preferences"
      idleText={value === "system" && reduced ? "Still · device setting" : undefined} />
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
        <PreferenceStatus className="motion-preference-status"
          ready={ready} saving={saving} error={error} saved={saved}
          retry={retry} retryLabel="Reload motion preferences"
          idleText={preferences.motion === "system" && reduced ? "Still · device setting" : undefined} />
      </div>
    </div>
  </SettingsSection>;
}
