import { useEffect, useRef, useState, type FormEvent } from "react";
import Banner from "./Banner";
import { RotateCw } from "lucide-react";
import { api, read, type Schema } from "./api";
import Button from "./Button";
import Reveal, { Swap } from "./Reveal";
import SettingsSection from "./SettingsSection";
import { CommandError, QueryResult, useQuery, useCommand } from "./useQuery";

type Listing = Schema["ServerSettings"];
type Setting = Schema["ServerSetting"];
type Value = Setting["value"];

const show = (value: Value) => value === null ? "none" : value === true ? "on" : value === false ? "off" : String(value);

/** A strictly-positive (exclusive minimum) number the server would refuse, in its
 * words. An integer field's `min` is the next whole number, so the browser already
 * refuses it there; a decimal one has no smallest value above the bound to use. */
function belowExclusiveMinimum(setting: Setting, value: Value) {
  const bound = setting.exclusive_minimum;
  if (bound == null || (setting.kind !== "integer" && setting.kind !== "number") || value === null || value === "") return "";
  return Number(value) > bound ? "" : `${setting.label} must be greater than ${bound}.`;
}

// How long a restart may take before the page stops waiting for the server.
const RESTART_WAIT_MS = 120_000;

/** Server settings saved in the database, applied by restarting from here.
 * Settings shows it to administrators (and a local install's single user) only. */
export default function ServerSettings() {
  const query = useQuery((signal) => read(api.GET("/api/server-settings", { signal })));
  return <QueryResult query={query} label="server settings" presentation="panel">
    {listing => <ServerSettingsForm listing={listing} onSaved={query.setData} />}
  </QueryResult>;
}

function ServerSettingsForm({ listing, onSaved }: { listing: Listing; onSaved: (listing: Listing) => void }) {
  // Number fields keep the typed text until saving, so clearing one does not snap to 0.
  const [draft, setDraft] = useState<Record<string, Value>>({});
  const [busy, setBusy] = useState<"" | "save" | "confirm" | "restart">("");
  // This screen's failures: fail(e) reports, the shared banner shows them.
  const errors = useCommand();
  const [notice, setNotice] = useState("");
  // Leaving Settings while waiting for a restart stops the wait, so it never reloads another page.
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);
  const settings = listing.groups.flatMap(group => group.settings);
  const changed = Object.keys(draft).length > 0;
  const pending = settings.filter(setting => setting.value !== setting.running);
  function edit(setting: Setting, value: Value) {
    setNotice("");
    setDraft(current => {
      const next = { ...current };
      if (String(value ?? "") === String(setting.value ?? "")) delete next[setting.key];
      else next[setting.key] = value;
      return next;
    });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    const refused = settings.map(setting => setting.key in draft ? belowExclusiveMinimum(setting, draft[setting.key]) : "").find(Boolean);
    if (refused) {
      setNotice("");
      errors.setError(refused);
      return;
    }
    setBusy("save");
    errors.dismiss();
    try {
      const values = Object.fromEntries(Object.entries(draft).map(([key, value]) => {
        const setting = settings.find(item => item.key === key);
        const number = setting?.kind === "integer" || setting?.kind === "number";
        return [key, number && typeof value === "string" ? (value === "" ? null : Number(value)) : value];
      }));
      onSaved(await read(api.PUT("/api/server-settings", { body: { values } })));
      setDraft({});
      setNotice("Saved. Restart the server to apply the changes.");
    } catch (e) { errors.fail(e); }
    finally { setBusy(""); }
  }
  async function restart() {
    setBusy("restart");
    errors.dismiss();
    setNotice("");
    const signal = lifetime.current?.signal;
    try {
      await read(api.POST("/api/server/restart"));
    } catch (e) {
      if (signal?.aborted) return;
      errors.fail(e);
      setBusy("");
      return;
    }
    // The restarted server reports a new boot id; until then requests fail or show the old one.
    const deadline = Date.now() + RESTART_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (signal?.aborted) return;
      const boot = await read(api.GET("/api/server-settings", { signal })).then(result => result.boot_id, () => null);
      if (signal?.aborted) return;
      if (boot && boot !== listing.boot_id) { window.location.reload(); return; }
    }
    setBusy("");
    errors.setError("The server has not come back yet. Check it from the host, then refresh this page.");
  }
  function field(setting: Setting) {
    const value = setting.key in draft ? draft[setting.key] : setting.value;
    const id = `server-setting-${setting.key}`;
    const help = <small id={`${id}-help`}>
      {setting.help} Default {show(setting.default)}.
      {setting.value !== setting.running && ` Running with ${show(setting.running)} until restart.`}
    </small>;
    if (setting.kind === "boolean")
      return <label className="check-row server-setting-check" key={setting.key}>
        <input type="checkbox" checked={value === true} aria-describedby={`${id}-help`}
          onChange={event => edit(setting, event.target.checked)} />
        <span>{setting.label}{help}</span>
      </label>;
    return <div className="server-setting" key={setting.key}>
      <label htmlFor={id}>{setting.label}</label>
      {setting.kind === "choice"
        ? <select id={id} value={String(value)} aria-describedby={`${id}-help`} onChange={event => edit(setting, event.target.value)}>
          {setting.choices?.map(choice => <option key={choice} value={choice}>{choice.replace(/_/g, " ")}</option>)}
        </select>
        : <input id={id} type="number" inputMode={setting.kind === "integer" ? "numeric" : "decimal"}
          step={setting.kind === "integer" ? 1 : "any"} min={setting.minimum ?? (setting.kind === "integer" && setting.exclusive_minimum != null ? Math.floor(setting.exclusive_minimum) + 1 : undefined)} max={setting.maximum ?? undefined}
          required={!setting.nullable} placeholder={setting.nullable ? "None" : undefined} aria-describedby={`${id}-help`}
          value={value === null ? "" : String(value)}
          onChange={event => edit(setting, event.target.value)} />}
      {help}
    </div>;
  }
  return <SettingsSection id="settings-server" title="Server"
    description="Engine, analysis and sync settings for everyone on this server. Saved changes apply when the server restarts.">
    {notice && <Banner tone="success" onDismiss={() => setNotice("")}>{notice}</Banner>}
    <CommandError command={errors} />
    <div className="settings-tool settings-tool-row">
      <div>
        <h3>Restart server</h3>
        <p>{!listing.restart_available
          ? "This server was not started with python -m trainer, so restart it from the host."
          : pending.length
            ? `${pending.length} saved ${pending.length === 1 ? "change applies" : "changes apply"} after a restart. Analysis in progress stops and resumes afterwards.`
            : "Analysis in progress stops and resumes afterwards."}</p>
      </div>
      {listing.restart_available && <Swap className="settings-tool-actions">
        {busy === "confirm"
          ? <div className="button-row" key="confirm">
            <Button size="compact" variant="primary" onClick={() => void restart()}><RotateCw size={16} />Restart now</Button>
            <Button size="compact" variant="quiet" onClick={() => setBusy("")}>Cancel</Button>
          </div>
          : <div className="button-row" key="restart"><Button size="compact" variant="secondary" disabled={!!busy} onClick={() => setBusy("confirm")}>
            <RotateCw size={16} />{busy === "restart" ? "Restarting…" : "Restart server"}
          </Button></div>}
      </Swap>}
    </div>
    <form className="server-settings" onSubmit={save}>
      {listing.groups.map(group => <details className="disclosure" key={group.title}>
        <summary>{group.title}</summary>
        <div className="server-settings-fields">{group.settings.map(field)}</div>
      </details>)}
      <div className="button-row">
        <Button type="submit" variant="primary" disabled={!changed || !!busy}>{busy === "save" ? "Saving…" : "Save settings"}</Button>
        <Reveal axis="inline">{changed && <Button variant="quiet" disabled={!!busy} onClick={() => setDraft({})}>Discard changes</Button>}</Reveal>
      </div>
    </form>
  </SettingsSection>;
}
