import "./choice-group.css";

export default function ChoiceGroup<Value extends string | number>({ label, options, value, onChange }: {
  label: string;
  options: readonly { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  return <div className="choice-group" role="group" aria-label={label}>
    {options.map(option => <button type="button" key={option.value}
      aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
