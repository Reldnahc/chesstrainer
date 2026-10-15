import { useState, type FormEvent } from "react";
import Banner from "./Banner";
import { DoorClosed, DoorOpen, KeyRound, ShieldCheck, Trash2, UserCheck, UserPlus, UserX } from "lucide-react";
import { api, read, type Schema } from "./api";
import { NewPasswordInput, UsernameInput } from "./accountFields";
import Button from "./Button";
import { RevealList, Swap } from "./Reveal";
import SettingsSection from "./SettingsSection";
import { QueryResult, useCommand, useQuery } from "./useQuery";

type ManagedAccount = Schema["ManagedAccount"];
type Pending = { id: string; action: "password" | "delete" } | { id: "new"; action: "add" } | null;

/** Administrator account management: add members, open sign-ups, reset passwords, disable, promote and delete accounts. */
export default function AccountAdmin({ selfId }: { selfId: string }) {
  const listing = useQuery((signal) => read(api.GET("/api/auth/accounts", { signal })));
  const command = useCommand();
  const busy = !!command.busy;
  const [username, setUsername] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [password, setPassword] = useState("");
  function act(action: () => Promise<unknown>, message: string) {
    setNotice("");
    void command.run(true, action, () => {
      setPending(null);
      setPassword("");
      setUsername("");
      setNotice(message);
      listing.retry();
    });
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
  return <QueryResult query={listing} label="accounts" presentation="panel">{({ accounts, signups_open: signupsOpen }) =>
  <SettingsSection id="settings-accounts" title="Accounts"
    description="Everyone who can sign in to this Fieldwork server. Add members here, or open sign-ups so people can create their own.">
    {notice && <Banner tone="success" onDismiss={() => setNotice("")}>{notice}</Banner>}
    {command.error && <Banner tone="error" onDismiss={command.dismiss}>{command.error}</Banner>}
    <div className="settings-tool settings-tool-row">
      <div>
        <h3>Sign-ups</h3>
        <p>{signupsOpen ? "Open. Anyone who can reach this server can create an account." : "Closed. Only administrators can add accounts."}</p>
      </div>
      <div className="button-row">
        <Button size="compact" variant="secondary" disabled={busy}
          onClick={() => act(() => read(api.PUT("/api/auth/signups", { body: { open: !signupsOpen } })),
            signupsOpen ? "Sign-ups are closed." : "Sign-ups are open. Anyone who can reach this server can create an account.")}>
          {signupsOpen ? <><DoorClosed size={16} />Close sign-ups</> : <><DoorOpen size={16} />Open sign-ups</>}
        </Button>
      </div>
    </div>
    <div className="settings-tool settings-tool-row">
      <div>
        <h3>Add member</h3>
        <p>Set a temporary password and pass it on. They choose their own when they first sign in.</p>
      </div>
      <Swap className="settings-tool-actions">{adding
        ? <form className="button-row account-password-form" key="form" onSubmit={addMember}>
          <label>
            <span>Username</span>
            <UsernameInput autoFocus value={username} onChange={event => setUsername(event.target.value)} />
          </label>
          <label>
            <span>Temporary password</span>
            <NewPasswordInput value={password} onChange={event => setPassword(event.target.value)} />
          </label>
          <Button type="submit" size="compact" variant="primary" disabled={busy}>Add member</Button>
          <Button size="compact" variant="quiet" onClick={() => choose(null)}>Cancel</Button>
        </form>
        : <div className="button-row" key="actions">
          <Button size="compact" variant="secondary" disabled={busy} onClick={() => choose({ id: "new", action: "add" })}>
            <UserPlus size={16} />Add member
          </Button>
        </div>}</Swap>
    </div>
    <RevealList>{accounts.map(account => {
      const self = account.id === selfId;
      const resetting = pending?.id === account.id && pending.action === "password";
      const deleting = pending?.id === account.id && pending.action === "delete";
      return <div className="settings-tool settings-tool-row" key={account.id}>
        <div>
          <h3>{account.username}{self && " (you)"}</h3>
          <p>{account.admin ? "Administrator" : "Member"}{account.disabled && " · Disabled"} · Joined {new Date(account.created).toLocaleDateString()}</p>
        </div>
        <Swap className="settings-tool-actions">{resetting
          ? <form className="button-row account-password-form" key="password" onSubmit={event => resetPassword(event, account)}>
            <label>
              <span>Temporary password for {account.username}</span>
              <NewPasswordInput autoFocus value={password} onChange={event => setPassword(event.target.value)} />
            </label>
            <Button type="submit" size="compact" variant="primary" disabled={busy}>Set temporary password</Button>
            <Button size="compact" variant="quiet" onClick={() => choose(null)}>Cancel</Button>
          </form>
          : deleting
            ? <div className="button-row" key="delete">
              <Button size="compact" variant="secondary" disabled={busy}
                onClick={() => act(() => read(api.DELETE("/api/auth/accounts/{account_id}", path(account))), `Deleted ${account.username} and their games.`)}>
                <Trash2 size={16} />Delete account and games
              </Button>
              <Button size="compact" variant="quiet" onClick={() => choose(null)}>Keep it</Button>
            </div>
            : !self && <div className="button-row" key="actions">
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
            </div>}</Swap>
      </div>;
    })}</RevealList>
    <p className="small muted">Deleting an account removes its games, reviews and training history for good. Disable it instead to keep them. Change your own password above.</p>
  </SettingsSection>}</QueryResult>;
}
