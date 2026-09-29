import { ArrowRight } from "lucide-react";
import Button from "./Button";

export function ImportAnalysisOption({ analyze, onChange }: {
  analyze: boolean;
  onChange: (analyze: boolean) => void;
}) {
  return (
    <label className="import-analysis-option">
      <input type="checkbox" checked={analyze} onChange={event => onChange(event.target.checked)} />
      Also analyze these games for training
    </label>
  );
}

export function ImportSubmitButton({ analyze, busy, busyLabel, disabled = false }: {
  analyze: boolean;
  busy: boolean;
  busyLabel: string;
  disabled?: boolean;
}) {
  return (
    <Button type="submit" variant="primary" disabled={busy || disabled}>
      {busy ? busyLabel : analyze ? "Import & analyze games" : "Import games"}
      <ArrowRight size={17} aria-hidden="true" />
    </Button>
  );
}
