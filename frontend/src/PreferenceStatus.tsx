import Button from "./Button";
import "./preference-status.css";

export default function PreferenceStatus({
  ready, saving, error, saved, retry, retryLabel, idleText,
  placement = "field", className = "",
}: {
  ready: boolean;
  saving: boolean;
  error: string;
  saved: boolean;
  retry: () => void;
  retryLabel: string;
  idleText?: string;
  placement?: "heading" | "field";
  className?: string;
}) {
  const state = saving ? "saving" : error ? "error" : !ready ? "loading" : saved ? "saved" : "idle";
  const text = state === "saving" ? "Saving…" : state === "loading" ? "Loading…" : state === "saved" ? "Saved" : idleText;
  return <div className={`preference-status preference-status--${placement} ${className}`.trim()}
    role="status" aria-atomic="true" data-state={state}>
    {state === "error" ? <>{error}{" "}<Button size="compact" variant="quiet" onClick={retry}>{retryLabel}</Button></> : text}
  </div>;
}
