import type { MotionPreference } from "./motion";
import "./motion-select.css";

export default function MotionSelect({id, label, describedBy, value, disabled = false, layout = "inline", onChange}: {
  id: string;
  label: string;
  describedBy?: string;
  value: MotionPreference;
  disabled?: boolean;
  layout?: "inline" | "stacked";
  onChange: (value: MotionPreference) => void;
}) {
  return <div className="motion-setting" data-layout={layout}>
    <label htmlFor={id}>{label}</label>
    <select id={id} aria-describedby={describedBy} disabled={disabled}
      value={value} onChange={event => onChange(event.target.value as MotionPreference)}>
      <option value="system">Use device setting</option>
      <option value="natural">Animated</option>
      <option value="still">Still</option>
    </select>
  </div>;
}
