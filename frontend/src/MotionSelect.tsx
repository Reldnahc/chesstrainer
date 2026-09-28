import type { MotionPreference } from "./motion";

export default function MotionSelect({id, label, value, disabled, onChange}: {
  id: string;
  label: string;
  value: MotionPreference;
  disabled: boolean;
  onChange: (value: MotionPreference) => void;
}) {
  return <div className="motion-setting">
    <div>
      <label htmlFor={id}>{label}</label>
      <span id={`${id}-help`}>
        Uses your device setting by default. Animated or Still overrides it.
      </span>
    </div>
    <select id={id} aria-describedby={`${id}-help`} disabled={disabled}
      value={value} onChange={event => onChange(event.target.value as MotionPreference)}>
      <option value="system">Use device setting</option>
      <option value="natural">Animated</option>
      <option value="still">Still</option>
    </select>
  </div>;
}
