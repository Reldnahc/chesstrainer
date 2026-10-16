import Button from "./Button";
import Notice from "./Notice";
import Reveal, { Swap } from "./Reveal";
import { useState } from "react";
import { api, read } from "./api";
import PageTitle from "./PageTitle";
import ImportSettings from "./Import";
import AccountSettings from "./AccountSettings";
import { useAccount, useAdministrator } from "./accountContext";
import CoachSettings from "./coach/CoachSettings";
import MotionSettings from "./MotionSettings";
import AudioSettings from "./audio/AudioSettings";
import SettingsSection from "./SettingsSection";
import SectionNavigation from "./SectionNavigation";
import Link from "./Link";
import { ExternalLink } from "lucide-react";
import { navigate, settingsPath, settingsSections, type SettingsTab } from "./navigation";
import CourseSettings from "./study/CourseSettings";
import AccountAdmin from "./AccountAdmin";
import ServerSettings from "./ServerSettings";
import { CommandError, QueryError, useCommand, useQuery } from "./useQuery";

const labels: Record<SettingsTab, string> = {
  imports: "Games & imports",
  coach: "Coach & animations",
  sound: "Sound",
  account: "Account",
  courses: "Courses",
  advanced: "Advanced",
};

export default function SettingsScreen({ section, importSource, restoringScroll }: {
  section: SettingsTab;
  importSource: string | null;
  restoringScroll: boolean;
}) {
  const account = useAccount();
  // Only administrators (or the single user of a local install) manage courses and the server.
  const administrator = useAdministrator();
  // Only Settings shows the engine's health (the import form's engine notice and Deepen).
  const health = useQuery((signal) => read(api.GET("/api/health", { signal })));
  const shown = (id: SettingsTab) => (id !== "account" || !!account) && (id !== "courses" || administrator);
  const active = shown(section) ? section : "imports";
  const [message, setMessage] = useState("");
  // Training tools' commands, and the import section's failures, each with their own banner.
  const command = useCommand<"classify" | "deepen">();
  const importErrors = useCommand();
  const busy = command.busy;
  // A failure belongs to the section (and import source) it happened in: another
  // one drops it in the render that shows it.
  const place = `${active}:${importSource ?? ""}`;
  const [shownPlace, setShownPlace] = useState(place);
  if (shownPlace !== place) {
    setShownPlace(place);
    command.dismiss();
    importErrors.dismiss();
  }
  function classify(enrich = false) {
    setMessage("");
    void command.run(enrich ? "deepen" : "classify",
      (signal) => read(api.POST(enrich ? "/api/classifications/enrich" : "/api/classifications/retry", { signal })),
      () => setMessage(enrich ? "Additional analysis queued for unclear training positions." : "Training labels queued."));
  }
  return (
    <>
      <PageTitle title="Settings" />
      <CommandError command={command} />
      <CommandError command={importErrors} />
      {/* Without the engine's health, the import form's engine notice and Deepen wait; say why. */}
      <QueryError query={health} label="the analysis engine's status" />
      <SectionNavigation label="Settings sections" current={active}
        items={settingsSections.filter(shown).map(id => ({ id, label: labels[id], href: settingsPath(id) }))} />
      {/* Sections crossfade, and the page height follows, when the tab changes. */}
      <Swap><div className="settings-content" key={active}>
        {active === "imports" && <ImportSettings health={health.data ?? null} fail={importErrors.fail} importSource={importSource} restoringScroll={restoringScroll}
          onImportSourceChange={source => navigate(settingsPath("imports", { importSource: source ?? undefined }))} />}
        {active === "coach" && <><MotionSettings /><CoachSettings /></>}
        {active === "sound" && <AudioSettings />}
        {active === "account" && <AccountSettings />}
        {active === "account" && account?.admin && <AccountAdmin selfId={account.id} />}
        {active === "courses" && <CourseSettings />}
        {active === "advanced" && <>
          <SettingsSection id="settings-training" title="Training tools">
            <div className="settings-tool">
              <div><h3>Refresh training patterns</h3><p>Update the labels on saved positions using their existing analysis.</p></div>
              <Button variant="secondary" disabled={!!busy} onClick={() => classify()}>
                {busy === "classify" ? "Queuing…" : "Classify saved games"}
              </Button>
            </div>
            <div className="settings-tool">
              <div><h3>Investigate unclear positions</h3><p>Run additional engine analysis where the training explanation needs more evidence.</p></div>
              <Button variant="secondary" disabled={!!busy || !health.data} onClick={() => classify(true)}>
                {busy === "deepen" ? "Queuing…" : "Deepen unclear positions"}
              </Button>
            </div>
            <div className="settings-tool-status">
              <Notice announcement="status" appearance="inline">
                {/* Each request clears the region so its result is announced again; the next result grows in. */}
                <Reveal exit={false}>{message}</Reveal>
              </Notice>
              <Link href={settingsPath("imports", { anchor: "settings-activity" })}>View import & analysis activity</Link>
            </div>
          </SettingsSection>
          {administrator && <ServerSettings />}
          <SettingsSection id="settings-source" title="Source code">
            <p className="settings-source">Fieldwork is open source (GPL/AGPL). <a href="https://github.com/Reldnahc/chesstrainer" target="_blank" rel="noopener noreferrer">Source code on GitHub<ExternalLink size={12} aria-hidden="true" /></a></p>
          </SettingsSection>
        </>}
      </div></Swap>
    </>
  );
}
