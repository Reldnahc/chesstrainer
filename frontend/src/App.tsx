import { useCallback, useEffect, useState } from "react";
import {
  FileUp,
  BookOpen,
  Flag,
  Focus,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { api, type Health } from "./api";
import ReviewScreen from "./Review";
import GamesScreen from "./GameReview";
import ImportScreen from "./Import";
import SettingsScreen from "./Settings";
import WeaknessScreen from "./Weaknesses";
import EvidenceDialog from "./EvidenceDialog";
import { clearExerciseLink } from "./navigation";
import appMark from "./assets/fieldwork.svg";
const tabs = [
  ["Review", Focus],
  ["Games", BookOpen],
  ["Weaknesses", Flag],
  ["Import", FileUp],
  ["Settings", Settings2],
] as const;
type Tab = (typeof tabs)[number][0];
export default function App() {
  const [tab, setTab] = useState<Tab>("Review");
  const [focusSkill, setFocusSkill] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState(false);
  const [token, setToken] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const [exercise, setExercise] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("exercise"),
  );
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const fail = useCallback(
    (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    [],
  );
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("unit"))
      clearExerciseLink();
    const connect = () => setConnection(true);
    window.addEventListener("connection-required", connect);
    api<Health>("/health").then(setHealth).catch(fail);
    return () => window.removeEventListener("connection-required", connect);
  }, [refresh, fail]);
  function navigate(next: Tab) {
    setFocusSkill(null);
    clearExerciseLink();
    setTab(next);
    setError("");
    setExercise(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <div className="header-inner">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate("Review");
            }}
            aria-label="Fieldwork home"
          >
            <img src={appMark} width="34" height="34" alt="" />
            <span>
              fieldwork<span className="brand-sub">Chess training</span>
            </span>
          </a>
          <nav aria-label="Main navigation">
            {tabs.map(([name, Icon]) => (
              <button
                key={name}
                aria-current={tab === name ? "page" : undefined}
                className={tab === name ? "nav-item active" : "nav-item"}
                onClick={() => navigate(name)}
              >
                <Icon size={17} strokeWidth={1.7} />
                <span>{name}</span>
              </button>
            ))}
          </nav>
          <span className="local-label">
            <span className="status-dot" /> Local
          </span>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className={tab === "Review" ? "review-page" : "workspace-page"}
      >
        {error && (
          <div role="alert" className="notice error">
            {error}
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {connection ? (
          <section className="panel connection">
            <LockKeyhole />
            <h1>Connect to your workspace</h1>
            <p>Enter the LAN token configured on your host computer.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sessionStorage.setItem("lan-token", token);
                setConnection(false);
                setRefresh((v) => v + 1);
                setError("");
              }}
            >
              <label>
                Access token
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />
              </label>
              <button className="primary">Connect</button>
            </form>
          </section>
        ) : (
          <>
            {tab === "Review" && (
              <ReviewScreen
                key={`${refresh}-${focusSkill}`}
                focusSkill={focusSkill}
                onExitFocus={() => navigate("Review")}
                requested={exercise}
                onImport={() => navigate("Import")}
                fail={fail}
                onEvidence={setEvidenceId}
              />
            )}
            {tab === "Import" && <ImportScreen health={health} fail={fail} />}
            {tab === "Games" && <GamesScreen onImport={() => navigate("Import")} />}
            {tab === "Weaknesses" && (
              <WeaknessScreen
                onPractice={(skill) => {
                  navigate("Review");
                  setFocusSkill(skill);
                }}
                onEvidence={setEvidenceId}
                fail={fail}
              />
            )}
            {tab === "Settings" && <SettingsScreen fail={fail} />}
          </>
        )}
      </main>
      <footer className="app-footer">
        <span>
          FIELDWORK <span className="footer-divider">/</span> PERSONAL CHESS
          TRAINING
        </span>
        <span>
          <ShieldCheck size={14} /> Games & practice stay on this computer
        </span>
      </footer>
      {evidenceId && (
        <EvidenceDialog
          id={evidenceId}
          onClose={() => setEvidenceId(null)}
          fail={fail}
        />
      )}
    </>
  );
}
