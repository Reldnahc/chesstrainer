import { useState, type FormEvent } from "react";
import { api, read, type Schema } from "./api";
import Button from "./Button";
import Notice from "./Notice";
import Reveal from "./Reveal";

/** Choose a new password: Settings (Account), and after an administrator's reset. */
export default function ChangePasswordForm({ currentLabel = "Current password", submitLabel = "Change password", onChanged }: {
  currentLabel?: string;
  submitLabel?: string;
  onChanged: (user: Schema["Account"]) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (next !== confirm) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { user } = await read(api.POST("/api/auth/password", { body: { current_password: current, new_password: next } }));
      setCurrent("");
      setNext("");
      setConfirm("");
      onChanged(user);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <form className="password-form" onSubmit={submit}>
    <Reveal>{error && <Notice announcement="alert" tone="error">{error}</Notice>}</Reveal>
    <label>
      {currentLabel}
      <input type="password" autoComplete="current-password" maxLength={128} required value={current} onChange={event => setCurrent(event.target.value)} />
    </label>
    <label>
      New password
      <input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={next} onChange={event => setNext(event.target.value)} />
    </label>
    <label>
      Confirm new password
      <input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={confirm} onChange={event => setConfirm(event.target.value)} />
    </label>
    <p className="small muted">Use at least 10 characters. Your other devices will be signed out.</p>
    <div className="button-row">
      <Button type="submit" variant="primary" disabled={busy}>{busy ? "Please wait…" : submitLabel}</Button>
    </div>
  </form>;
}
