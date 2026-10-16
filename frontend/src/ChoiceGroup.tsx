import { useId } from "react";
import usePhone from "./usePhone";
import Button from "./Button";
import "./choice-group.css";

/** Pressed buttons for one local choice. With phone="select", phones show the
 *  same choice as a native select so a long set of options stays on one line.
 *  `showLabel` shows `label` above the options (beside them in the compact
 *  toolbar row) and names the group by that text, so a page never writes its own
 *  label or id; `size="compact"` is the denser row for toolbars (Insights' filters). */
export default function ChoiceGroup<Value extends string | number>({ label, showLabel = false, options, value, onChange, phone = "buttons", size = "ordinary" }: {
  label: string;
  showLabel?: boolean;
  options: readonly { value: Value; label: string; disabled?: boolean }[];
  value: Value;
  onChange: (value: Value) => void;
  phone?: "buttons" | "select";
  size?: "ordinary" | "compact";
}) {
  const isPhone = usePhone();
  const labelId = useId();
  const name = showLabel ? { "aria-labelledby": labelId } : { "aria-label": label };
  const control = phone === "select" && isPhone
    ? <select className="choice-group-select" {...name} value={String(value)}
      onChange={event => { const chosen = options.find(option => String(option.value) === event.target.value); if (chosen) onChange(chosen.value); }}>
      {options.map(option => <option key={option.value} value={String(option.value)} disabled={option.disabled}>{option.label}</option>)}
    </select>
    : <div className={size === "compact" ? "choice-group choice-group--compact" : "choice-group"} role="group" {...name}>
      {options.map(option => <Button variant="secondary" size={size} key={option.value}
        aria-pressed={value === option.value} disabled={option.disabled} onClick={() => onChange(option.value)}>{option.label}</Button>)}
    </div>;
  if (!showLabel) return control;
  return <div className={size === "compact" ? "choice-field choice-field--compact" : "choice-field"}>
    <span className="choice-field-label" id={labelId}>{label}</span>
    {control}
  </div>;
}
