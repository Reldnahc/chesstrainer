import { useEffect, useState, type FormEvent } from "react";
import Toast from "./Toast";
import { RotateCw } from "lucide-react";
import { api, read, type Schema } from "./api";
import Button from "./Button";
import Reveal, { Swap } from "./Reveal";
import SettingsSection from "./SettingsSection";

type Listing = Schema["ServerSettings"];
type Setting = Schema["ServerSetting"];
type Value = Setting["value"];

const show = (value: Value) => value === null ? "none" : value === true ? "on" : value === false ? "off" : String(value);

/** Server settings saved in the database, applied by restarting from here. Administrators only. */
export default function ServerSettings() {
  const [listing, setListing] = useState<Listing | null>(null);
  // Number fields keep the typed text until saving, so clearing one does not snap to 0.
  const [draft, setDraft] = useState<Record<string, Value>>({});
  const [busy, setBusy] = useState<"" | "save" | "confirm" | "restart">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    // Members get 403; the section stays hidden for them.
    read(api.GET("/api/server-settings", { signal: controller.signal }))
      .then(result => { if (!controller.signal.aborted) setListing(result); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  if (!listing) return null;
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
    setBusy("save");
    setError("");
    try {
      const values = Object.fromEntries(Object.entries(draft).map(([key, value]) => {
        const setting = settings.find(item => item.key === key);
        const number = setting?.kind === "integer" || setting?.kind === "number";
        return [key, number && typeof value === "string" ? (value === "" ? null : Number(value)) : value];
      }));
      setListing(await read(api.PUT("/api/server-settings", { body: { values } })));
      setDraft({});
      setNotice("Saved. Restart the server to apply the changes.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }
  async function restart() {
    setBusy("restart");
    setError("");
    setNotice("");
    try {
      await read(api.POST("/api/server/restart"));
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
      return;
    }
    // The restarted server reports a new boot id; until then requests fail or show the old one.
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const boot = await read(api.GET("/api/server-settings")).then(result => result.boot_id, () => null);
      if (boot && boot !== listing?.boot_id) { window.location.reload(); return; }
    }
    setBusy("");
    setError("The server has not come back yet. Check it from the host, then refresh this page.");
  }
  function field(setting: Setting) {
    const value = setting.key in draft ? draft[setting.key] : setting.value;
    const id = `server-setting-${setting.key}`;
    const help = <small id={`${id}-help`}>
      {setting.help} Default {show(setting.default)}.
      {setting.value !== setting.running && ` Running with ${show(setting.running)} until restart.`}
    </small>;
    if (setting.kind === "boolean")
      return <label className="server-setting-check" key={setting.key}>
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
          step={setting.kind === "integer" ? 1 : "any"} min={setting.minimum ?? undefined} max={setting.maximum ?? undefined}
          required={!setting.nullable} placeholder={setting.nullable ? "None" : undefined} aria-describedby={`${id}-help`}
          value={value === null ? "" : String(value)}
          onChange={event => edit(setting, event.target.value)} />}
      {help}
    </div>;
  }
  return <SettingsSection id="settings-server" title="Server"
    description="Engine, analysis and sync settings for everyone on this server. Saved changes apply when the server restarts.">
    {notice && <Toast tone="success" onDismiss={() => setNotice("")}>{notice}</Toast>}
    {error && <Toast tone="error" onDismiss={() => setError("")}>{error}</Toast>}
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
