import { useState } from "react";
import { useMotionPreferences } from "./MotionProvider";
import MotionSelect from "./MotionSelect";
import { useReducedMotion } from "./useReducedMotion";

export default function MotionSettings() {
  const {preferences, ready, saving, error, save, retry} = useMotionPreferences();
  const reduced = useReducedMotion();
  const [saved, setSaved] = useState(false);
  return <section className="panel settings-panel" aria-labelledby="motion-settings-title">
    <h2 id="motion-settings-title">Animations</h2>
    <p>Chess pieces, board feedback and interface effects. Your coach has its own motion setting.</p>
    <MotionSelect id="interface-motion" label="Piece & interface motion"
      value={preferences.motion} disabled={!ready || saving}
      onChange={async motion => {
        setSaved(false);
        setSaved(await save({motion}));
      }} />
    <p className="motion-preference-status" role="status">
      {saving ? "Saving…" : error ? <>
        {error}{" "}<button className="text-button" onClick={retry}>Reload motion preferences</button>
      </> : !ready ? "Loading motion preferences…"
        : preferences.motion === "system" && reduced
          ? "Your device requests reduced motion. Pieces and interface effects will stay still."
          : saved ? "Saved. This choice follows your account."
            : "Your motion preference is saved with your workspace."}
    </p>
  </section>;
}
