import Button from "./Button";
import { useEffect, useState, type ReactNode } from "react";
import { api, errorMessage, onAuthRequired, read, setAccountSession, type Schema } from "./api";
import { AccountContext, GuestContext } from "./accountContext";
import { NewPasswordInput, PASSWORD_RULES, UsernameInput } from "./accountFields";
import { useRoute } from "./navigation";

import Onboarding from "./Onboarding";
import ChangePasswordForm from "./ChangePasswordForm";
import Notice from "./Notice";
import Reveal from "./Reveal";

type Identity = Schema["Identity"];

export default function AccountGate({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [signup, setSignup] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const route = useRoute();
  function accept(value: Identity) {
    setAccountSession(value.enabled, value.csrf);
    setIdentity(value);
    setPassword("");
  }
  useEffect(() => {
    const refresh = () =>
      read(api.GET("/api/auth/me"))
        .then(accept)
        .catch((e) => setError(errorMessage(e)));
    void refresh();
    return onAuthRequired("account", () => void refresh());
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      accept(
        await read(
          api.POST(signup && identity?.signups_open ? "/api/auth/signup" : "/api/auth/login", {
            body: { username, password },
          }),
        ),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function logout(all = false) {
    setError("");
    setBusy(true);
    try {
      await read(api.POST(all ? "/api/auth/logout-all" : "/api/auth/logout"));
      accept({ enabled: true, user: null, signups_open: identity?.signups_open });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (!identity)
    return (
      <main className="workspace-page">
        <p role="status">Connecting to Fieldwork…</p>
        <Reveal>{error && (
          <Notice announcement="alert" tone="error" appearance="inline"
            actions={<Button size="compact" variant="quiet" onClick={() => window.location.reload()}>Retry</Button>}>
            {error}
          </Notice>
        )}</Reveal>
      </main>
    );
  if (!identity.enabled) return <>{children}</>;
  // Anyone with a game's link may read its review without an account.
  const sharedGame = route.screen.kind === "games" && !!route.screen.gameId;
  if (!identity.user && sharedGame && !signingIn)
    return (
      <GuestContext.Provider value={() => setSigningIn(true)}>
        {children}
      </GuestContext.Provider>
    );
  // Administrators decide whether visitors may create their own accounts.
  const creating = signup && !!identity.signups_open;
  if (!identity.user)
    return (
      <main className="account-entry">
        <section className="panel">
          <p className="eyebrow">FIELDWORK</p>
          <h1>{creating ? "Create your account" : "Welcome back"}</h1>
          <p>Your games and training progress, on every device.</p>
          <Reveal>{error && (
            <Notice announcement="alert" tone="error">
              {error}
            </Notice>
          )}</Reveal>
          <form onSubmit={submit}>
            <label>
              Username
              <UsernameInput autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label>
              Password
              {/* Signing in checks only the length limit; the minimum is for new passwords. */}
              {creating
                ? <NewPasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
                : <input type="password" autoComplete="current-password" maxLength={PASSWORD_RULES.maxLength} required
                  value={password} onChange={(e) => setPassword(e.target.value)} />}
            </label>
            {creating && (
              <p className="small">
                Use at least {PASSWORD_RULES.minLength} characters. Your host can reset a forgotten
                password.
              </p>
            )}
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Please wait…" : creating ? "Create account" : "Sign in"}
            </Button>
          </form>
          {identity.signups_open ? (
            <Button
              disabled={busy}
              onClick={() => {
                setSignup(!signup);
                setError("");
              }}
            >
              {signup
                ? "Already have an account? Sign in"
                : "New here? Create an account"}
            </Button>
          ) : (
            <p className="small">New here? Ask whoever runs this Fieldwork server for an account.</p>
          )}
          {signingIn && sharedGame && (
            <Button variant="quiet" disabled={busy} onClick={() => setSigningIn(false)}>
              Back to the shared game
            </Button>
          )}
        </section>
      </main>
    );
  if (identity.user.password_change_required)
    return (
      <main className="account-entry">
        <section className="panel">
          <p className="eyebrow">FIELDWORK</p>
          <h1>Choose a new password</h1>
          <p>Your host gave you a temporary password. Enter it, then choose your own.</p>
          <Reveal>{error && <Notice announcement="alert" tone="error">{error}</Notice>}</Reveal>
          <ChangePasswordForm currentLabel="Temporary password" submitLabel="Save and continue"
            onChanged={user => setIdentity(current => current ? { ...current, user } : current)} />
          <Button disabled={busy} onClick={() => logout()}>Sign out</Button>
        </section>
      </main>
    );
  if (!identity.user.onboarding_completed)
    return <Onboarding key={identity.user.id} onComplete={user => setIdentity(current => current ? { ...current, user } : current)} />;
  return (
    <AccountContext.Provider
      value={{ user: identity.user, logout, busy, error }}
    >
      <div key={identity.user.id}>{children}</div>
    </AccountContext.Provider>
  );
}
