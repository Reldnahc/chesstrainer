import Button from "./Button";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, read, setAccountSession, type Schema } from "./api";
import { useRoute } from "./navigation";

import Onboarding from "./Onboarding";
import ChangePasswordForm from "./ChangePasswordForm";
import SettingsSection from "./SettingsSection";
import Notice from "./Notice";

export type Account = Schema["Account"];
type Identity = Schema["Identity"];
type AccountSession = {
  user: Account;
  logout: (all?: boolean) => Promise<void>;
  busy: boolean;
  error: string;
};
const AccountContext = createContext<AccountSession | null>(null);
export const useAccount = () => useContext(AccountContext)?.user ?? null;
// A signed-out visitor opening a shared game link; the value opens sign-in.
const GuestContext = createContext<(() => void) | null>(null);
export const useGuestSignIn = () => useContext(GuestContext);
export const useGuest = () => !!useContext(GuestContext);

export function AccountSettings() {
  const session = useContext(AccountContext);
  if (!session) return null;
  const { user, logout, busy, error } = session;
  return (<>
    <SettingsSection id="account-settings" title="Account" className="account-settings">
      <p>
        Signed in as <strong>{user.username}</strong>
      </p>
      <div className="account-actions">
        <Button disabled={busy} onClick={() => logout()}>
          Sign out
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => logout(true)}
        >
          Sign out all devices
        </Button>
      </div>
      {error && (
        <Notice announcement="alert" tone="error">
          {error}
        </Notice>
      )}
    </SettingsSection>
    <PasswordSettings />
  </>);
}

function PasswordSettings() {
  const [changed, setChanged] = useState(false);
  return (
    <SettingsSection id="password-settings" title="Password" description="Change the password you sign in with.">
      {changed && <Notice announcement="status" tone="success">Password changed. Your other devices are signed out.</Notice>}
      <ChangePasswordForm onChanged={() => setChanged(true)} />
    </SettingsSection>
  );
}

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
        .catch((e) => setError(e.message));
    void refresh();
    window.addEventListener("account-required", refresh);
    return () => window.removeEventListener("account-required", refresh);
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      accept(
        await read(
          api.POST(signup ? "/api/auth/signup" : "/api/auth/login", {
            body: { username, password },
          }),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout(all = false) {
    setError("");
    setBusy(true);
    try {
      await read(api.POST(all ? "/api/auth/logout-all" : "/api/auth/logout"));
      accept({ enabled: true, user: null });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!identity)
    return (
      <main className="workspace-page">
        <p role="status">Connecting to Fieldwork…</p>
        {error && (
          <Notice announcement="alert" tone="error" appearance="inline"
            actions={<Button size="compact" variant="quiet" onClick={() => window.location.reload()}>Retry</Button>}>
            {error}
          </Notice>
        )}
      </main>
    );
  if (!identity.enabled) return <>{children}</>;
  // Anyone with a game's link may read its review without an account.
  if (!identity.user && route.gameId && !signingIn)
    return (
      <GuestContext.Provider value={() => setSigningIn(true)}>
        {children}
      </GuestContext.Provider>
    );
  if (!identity.user)
    return (
      <main className="account-entry">
        <section className="panel">
          <p className="eyebrow">FIELDWORK</p>
          <h1>{signup ? "Create your account" : "Welcome back"}</h1>
          <p>Your games and training progress, on every device.</p>
          {error && (
            <Notice announcement="alert" tone="error">
              {error}
            </Notice>
          )}
          <form onSubmit={submit}>
            <label>
              Username
              <input
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9_-]+"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={10}
                maxLength={128}
                required
              />
            </label>
            {signup && (
              <p className="small">
                Use at least 10 characters. Your host can reset a forgotten
                password.
              </p>
            )}
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
            </Button>
          </form>
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
          {signingIn && route.gameId && (
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
          <p>Your host reset your password. Enter the temporary password they gave you, then choose your own.</p>
          {error && <Notice announcement="alert" tone="error">{error}</Notice>}
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
