import usePhone from "./usePhone";
import "./choice-group.css";

/** Pressed buttons for one local choice. With phone="select", phones show the
 *  same choice as a native select so a long set of options stays on one line. */
export default function ChoiceGroup<Value extends string | number>({ label, options, value, onChange, phone = "buttons" }: {
  label: string;
  options: readonly { value: Value; label: string; disabled?: boolean }[];
  value: Value;
  onChange: (value: Value) => void;
  phone?: "buttons" | "select";
}) {
  const isPhone = usePhone();
  if (phone === "select" && isPhone) return <select className="choice-group-select" aria-label={label} value={String(value)}
    onChange={event => { const chosen = options.find(option => String(option.value) === event.target.value); if (chosen) onChange(chosen.value); }}>
    {options.map(option => <option key={option.value} value={String(option.value)} disabled={option.disabled}>{option.label}</option>)}
  </select>;
  return <div className="choice-group" role="group" aria-label={label}>
    {options.map(option => <button type="button" key={option.value}
      aria-pressed={value === option.value} disabled={option.disabled} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
