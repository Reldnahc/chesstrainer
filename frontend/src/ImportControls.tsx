import { ArrowRight } from "lucide-react";
import Button from "./Button";

export function ImportSubmitButton({ busy, busyLabel, disabled = false }: {
  busy: boolean;
  busyLabel: string;
  disabled?: boolean;
}) {
  return (
    <Button type="submit" variant="primary" disabled={busy || disabled}>
      {busy ? busyLabel : "Import games"}
      <ArrowRight size={17} aria-hidden="true" />
    </Button>
  );
}
