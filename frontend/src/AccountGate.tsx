import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, read, setAccountSession, type Schema } from "./api";

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

export function AccountSettings() {
  const session = useContext(AccountContext);
  if (!session) return null;
  const { user, logout, busy, error } = session;
  return (
    <section
      className="panel account-settings"
      aria-labelledby="account-settings-title"
    >
      <h2 id="account-settings-title">Account</h2>
      <p>
        Signed in as <strong>{user.username}</strong>
      </p>
      <div className="account-actions">
        <button disabled={busy} onClick={() => logout()}>
          Sign out
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => logout(true)}
        >
          Sign out all devices
        </button>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
    </section>
  );
}

export default function AccountGate({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [signup, setSignup] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
          <p role="alert">
            {error}{" "}
            <button onClick={() => window.location.reload()}>Retry</button>
          </p>
        )}
      </main>
    );
  if (!identity.enabled) return <>{children}</>;
  if (!identity.user)
    return (
      <main className="account-entry">
        <section className="panel">
          <p className="eyebrow">FIELDWORK</p>
          <h1>{signup ? "Create your account" : "Welcome back"}</h1>
          <p>Your games and training progress, on every device.</p>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
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
            <button className="primary" disabled={busy}>
              {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
            </button>
          </form>
          <button
            disabled={busy}
            onClick={() => {
              setSignup(!signup);
              setError("");
            }}
          >
            {signup
              ? "Already have an account? Sign in"
              : "New here? Create an account"}
          </button>
        </section>
      </main>
    );
  return (
    <AccountContext.Provider
      value={{ user: identity.user, logout, busy, error }}
    >
      <div key={identity.user.id}>{children}</div>
    </AccountContext.Provider>
  );
}
