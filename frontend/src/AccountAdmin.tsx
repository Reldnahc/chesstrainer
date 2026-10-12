import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck, Trash2, UserCheck, UserPlus, UserX } from "lucide-react";
import { api, read, type Schema } from "./api";
import Button from "./Button";
import { LoadingState, UnavailableState } from "./LoadState";
import Notice from "./Notice";
import SettingsSection from "./SettingsSection";

type ManagedAccount = Schema["ManagedAccount"];
type Pending = { id: string; action: "password" | "delete" } | { id: "new"; action: "add" } | null;

/** Administrator account management: add members, reset passwords, disable, promote and delete accounts. */
export default function AccountAdmin({ selfId }: { selfId: string }) {
  const [accounts, setAccounts] = useState<ManagedAccount[] | null>(null);
  const [signupsOpen, setSignupsOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [password, setPassword] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    read(api.GET("/api/auth/accounts", { signal: controller.signal }))
      .then(result => {
        if (controller.signal.aborted) return;
        setAccounts(result.accounts);
        setSignupsOpen(result.signups_open);
      })
      .catch(e => { if (!controller.signal.aborted) setError((e as Error).message); });
    return () => controller.abort();
  }, [reload]);
  async function act(action: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setPending(null);
      setPassword("");
      setUsername("");
      setNotice(message);
      setReload(value => value + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const path = (account: ManagedAccount) => ({ params: { path: { account_id: account.id } } });
  function resetPassword(event: FormEvent, account: ManagedAccount) {
    event.preventDefault();
    void act(() => read(api.POST("/api/auth/accounts/{account_id}/password", { ...path(account), body: { password } })),
      `Set a temporary password for ${account.username} and signed them out. They will choose their own when they next sign in.`);
  }
  function addMember(event: FormEvent) {
    event.preventDefault();
    const name = username.trim().toLowerCase();
    void act(() => read(api.POST("/api/auth/accounts", { body: { username: name, password } })),
      `Added ${name}. Pass on the temporary password; they will choose their own when they first sign in.`);
  }
  function choose(next: Pending) {
    setPending(next);
    setPassword("");
    setUsername("");
  }
  const adding = pending?.action === "add";
  if (!accounts) return error ? <UnavailableState presentation="panel">{error}</UnavailableState> : <LoadingState presentation="panel">Loading accounts…</LoadingState>;
  return <SettingsSection id="settings-accounts" title="Accounts"
    description="Everyone who can sign in to this Fieldwork server. Administrators add and manage members here.">
    {notice && <Notice announcement="status" tone="success">{notice}</Notice>}
    {error && <Notice announcement="alert" tone="error">{error}</Notice>}
    <div className="settings-tool settings-tool-row">
      <div>
        <h3>Sign-ups</h3>
        <p>{signupsOpen
          ? "Open. Anyone who can reach this server can create an account. Set SIGNUPS_OPEN=false on the server to close them."
          : "Closed. Only administrators can add accounts. Set SIGNUPS_OPEN=true on the server to let people sign up."}</p>
      </div>
    </div>
    <div className="settings-tool settings-tool-row">
      <div>
        <h3>Add member</h3>
        <p>Set a temporary password and pass it on. They choose their own when they first sign in.</p>
      </div>
      {adding
        ? <form className="button-row account-password-form" onSubmit={addMember}>
          <label>
            <span>Username</span>
            <input autoComplete="off" minLength={3} maxLength={32} pattern="[a-zA-Z0-9_-]+" required autoFocus
              value={username} onChange={event => setUsername(event.target.value)} />
          </label>
          <label>
            <span>Temporary password</span>
            <input type="password" autoComplete="new-password" minLength={10} maxLength={128} required
              value={password} onChange={event => setPassword(event.target.value)} />
          </label>
          <Button type="submit" size="compact" variant="primary" disabled={busy}>Add member</Button>
          <Button size="compact" variant="quiet" onClick={() => choose(null)}>Cancel</Button>
        </form>
        : <div className="button-row">
          <Button size="compact" variant="secondary" disabled={busy} onClick={() => choose({ id: "new", action: "add" })}>
            <UserPlus size={16} />Add member
          </Button>
        </div>}
    </div>
    {accounts.map(account => {
      const self = account.id === selfId;
      const resetting = pending?.id === account.id && pending.action === "password";
      const deleting = pending?.id === account.id && pending.action === "delete";
      return <div className="settings-tool settings-tool-row" key={account.id}>
        <div>
          <h3>{account.username}{self && " (you)"}</h3>
          <p>{account.admin ? "Administrator" : "Member"}{account.disabled && " · Disabled"} · Joined {new Date(account.created).toLocaleDateString()}</p>
        </div>
        {resetting
          ? <form className="button-row account-password-form" onSubmit={event => resetPassword(event, account)}>
            <label>
              <span>Temporary password for {account.username}</span>
              <input type="password" autoComplete="new-password" minLength={10} maxLength={128} required autoFocus
                value={password} onChange={event => setPassword(event.target.value)} />
            </label>
            <Button type="submit" size="compact" variant="primary" disabled={busy}>Set temporary password</Button>
            <Button size="compact" variant="quiet" onClick={() => choose(null)}>Cancel</Button>
          </form>
          : deleting
            ? <div className="button-row">
              <Button size="compact" variant="secondary" disabled={busy}
                onClick={() => act(() => read(api.DELETE("/api/auth/accounts/{account_id}", path(account))), `Deleted ${account.username} and their games.`)}>
                <Trash2 size={16} />Delete account and games
              </Button>
              <Button size="compact" variant="quiet" onClick={() => choose(null)}>Keep it</Button>
            </div>
            : !self && <div className="button-row">
              <Button size="compact" variant="secondary" disabled={busy} onClick={() => choose({ id: account.id, action: "password" })}>
                <KeyRound size={16} />Reset password
              </Button>
              {!account.admin && <Button size="compact" variant="quiet" disabled={busy}
                onClick={() => act(() => read(api.POST("/api/auth/accounts/{account_id}/admin", path(account))), `${account.username} is now an administrator.`)}>
                <ShieldCheck size={16} />Make administrator
              </Button>}
              <Button size="compact" variant="quiet" disabled={busy}
                onClick={() => act(() => read(api.POST("/api/auth/accounts/{account_id}/access", { ...path(account), body: { disabled: !account.disabled } })),
                  account.disabled ? `${account.username} can sign in again.` : `${account.username} is disabled and signed out.`)}>
                {account.disabled ? <><UserCheck size={16} />Enable</> : <><UserX size={16} />Disable</>}
              </Button>
              <Button size="compact" variant="quiet" disabled={busy} onClick={() => choose({ id: account.id, action: "delete" })}>
                <Trash2 size={16} />Delete
              </Button>
            </div>}
      </div>;
    })}
    <p className="small muted">Deleting an account removes its games, reviews and training history for good. Disable it instead to keep them. Change your own password above.</p>
  </SettingsSection>;
}
