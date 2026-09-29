import { useId } from "react";

export default function ProviderUsernameField({
  providerName,
  label = `${providerName} username`,
  accessibleLabel = label,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder,
  description,
}: {
  providerName: string;
  label?: string;
  accessibleLabel?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  description?: string;
}) {
  const id = useId();
  const descriptionId = description ? `${id}-help` : undefined;
  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        aria-label={accessibleLabel}
        aria-describedby={descriptionId}
        value={value}
        onChange={event => onChange(event.target.value)}
        required={required}
        disabled={disabled}
        autoComplete="off"
        maxLength={50}
        pattern={required ? "[A-Za-z0-9_\\-]+" : "[A-Za-z0-9_\\-]*"}
        placeholder={placeholder}
      />
      {description && <small id={descriptionId}>{description}</small>}
    </label>
  );
}
