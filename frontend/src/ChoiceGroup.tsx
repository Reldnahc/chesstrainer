import usePhone from "./usePhone";
import "./choice-group.css";

/** Pressed buttons for one local choice. With phone="select", phones show the
 *  same choice as a native select so a long set of options stays on one line.
 *  A page that shows its own visible label passes its id as `labelId`, so the
 *  group is named by that text instead of repeating it; `size="compact"` is the
 *  denser row for toolbars (Insights' filters). */
export default function ChoiceGroup<Value extends string | number>({ label, labelId, options, value, onChange, phone = "buttons", size = "ordinary" }: {
  label: string;
  labelId?: string;
  options: readonly { value: Value; label: string; disabled?: boolean }[];
  value: Value;
  onChange: (value: Value) => void;
  phone?: "buttons" | "select";
  size?: "ordinary" | "compact";
}) {
  const isPhone = usePhone();
  const name = labelId ? { "aria-labelledby": labelId } : { "aria-label": label };
  if (phone === "select" && isPhone) return <select className="choice-group-select" {...name} value={String(value)}
    onChange={event => { const chosen = options.find(option => String(option.value) === event.target.value); if (chosen) onChange(chosen.value); }}>
    {options.map(option => <option key={option.value} value={String(option.value)} disabled={option.disabled}>{option.label}</option>)}
  </select>;
  return <div className={size === "compact" ? "choice-group choice-group--compact" : "choice-group"} role="group" {...name}>
    {options.map(option => <button type="button" key={option.value}
      aria-pressed={value === option.value} disabled={option.disabled} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
