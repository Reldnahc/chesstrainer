import Button from "./Button";
import Notice from "./Notice";
import Reveal, { Swap } from "./Reveal";
import { useEffect, useState } from "react";
import { api, read, type Health } from "./api";
import PageTitle from "./PageTitle";
import ImportSettings from "./Import";
import { AccountSettings, useAccount } from "./AccountGate";
import CoachSettings from "./coach/CoachSettings";
import MotionSettings from "./MotionSettings";
import AudioSettings from "./audio/AudioSettings";
import SettingsSection from "./SettingsSection";
import SectionNavigation from "./SectionNavigation";
import Link from "./Link";
import { ExternalLink } from "lucide-react";
import { navigate, type SettingsTab } from "./navigation";
import CourseSettings from "./study/CourseSettings";
import AccountAdmin from "./AccountAdmin";
import ServerSettings from "./ServerSettings";

const sections: { id: SettingsTab; label: string }[] = [
  { id: "imports", label: "Games & imports" },
  { id: "coach", label: "Coach & animations" },
  { id: "sound", label: "Sound" },
  { id: "account", label: "Account" },
  { id: "courses", label: "Courses" },
  { id: "advanced", label: "Advanced" },
];

export default function SettingsScreen({ health, fail, section, importSource, restoringScroll }: {
  health: Health | null;
  fail: (e: unknown) => void;
  section: SettingsTab;
  importSource: string | null;
  restoringScroll: boolean;
}) {
  const account = useAccount();
  // Only administrators (or the single user of a local install) manage courses.
  const [canManage, setCanManage] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    read(api.GET("/api/study/courses", { signal: controller.signal }))
      .then(result => { if (!controller.signal.aborted) setCanManage(!!result.can_manage); })
      .catch(() => { if (!controller.signal.aborted) setCanManage(false); });
    return () => controller.abort();
  }, []);
  const active = (section === "account" && !account) || (section === "courses" && canManage === false) ? "imports" : section;
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"classify" | "deepen" | null>(null);
  async function classify(enrich = false) {
    setBusy(enrich ? "deepen" : "classify");
    setMessage("");
    try {
      await read(api.POST(enrich ? "/api/classifications/enrich" : "/api/classifications/retry"));
      setMessage(enrich ? "Additional analysis queued for unclear training positions." : "Training labels queued.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <PageTitle title="Settings" />
      <SectionNavigation label="Settings sections" current={active}
        items={sections.filter(item => (item.id !== "account" || account) && (item.id !== "courses" || canManage)).map(item => ({
          ...item, href: item.id === "imports" ? "/settings" : `/settings?section=${item.id}`,
        }))} />
      {/* Sections crossfade, and the page height follows, when the tab changes. */}
      <Swap><div className="settings-content" key={active}>
        {active === "imports" && <ImportSettings health={health} fail={fail} importSource={importSource} restoringScroll={restoringScroll}
          onImportSourceChange={source => navigate(source ? `/settings?import=${encodeURIComponent(source)}` : "/settings")} />}
        {active === "coach" && <><MotionSettings /><CoachSettings /></>}
        {active === "sound" && <AudioSettings />}
        {active === "account" && <AccountSettings />}
        {active === "account" && account?.admin && <AccountAdmin selfId={account.id} />}
        {active === "courses" && canManage && <CourseSettings />}
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
              <Button variant="secondary" disabled={!!busy || !health} onClick={() => classify(true)}>
                {busy === "deepen" ? "Queuing…" : "Deepen unclear positions"}
              </Button>
            </div>
            <div className="settings-tool-status">
              <Notice announcement="status" appearance="inline">
                {/* Each request clears the region so its result is announced again; the next result grows in. */}
                <Reveal exit={false}>{message}</Reveal>
              </Notice>
              <Link href="/settings#settings-activity">View import & analysis activity</Link>
            </div>
          </SettingsSection>
          <ServerSettings />
          <SettingsSection id="settings-source" title="Source code">
            <p className="settings-source">Fieldwork is open source (GPL/AGPL). <a href="https://github.com/Reldnahc/chesstrainer" target="_blank" rel="noopener noreferrer">Source code on GitHub<ExternalLink size={12} aria-hidden="true" /></a></p>
          </SettingsSection>
        </>}
      </div></Swap>
    </>
  );
}
