import { lazy, Suspense, useCallback, useEffect, useState } from "react";
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
import { api, read, type Health } from "./api";
import ReviewScreen from "./Review";
import GamesScreen from "./GameReview";
import ImportScreen from "./Import";
import SettingsScreen from "./Settings";
import WeaknessScreen from "./Weaknesses";
import EvidenceDialog from "./EvidenceDialog";
import { navigate, pagePaths, useRoute } from "./navigation";
import Link from "./Link";
import appMark from "./assets/fieldwork.svg";
import { useAccount } from "./AccountGate";
import { useCoachPreferences } from "./coach/CoachProvider";
const CoachStudio = lazy(() => import("./coach/studio/CoachStudio"));
const tabs = [
  ["Review", Focus],
  ["Games", BookOpen],
  ["Weaknesses", Flag],
  ["Import", FileUp],
  ["Settings", Settings2],
] as const;
export default function App() {
  const account = useAccount();
  const { retry: reloadCoachPreferences } = useCoachPreferences();
  const route = useRoute();
  const { tab, focusSkill, exercise } = route;
  const [error, setError] = useState("");
  const [connection, setConnection] = useState(false);
  const [token, setToken] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const fail = useCallback(
    (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    [],
  );
  useEffect(() => {
    let active = true;
    const connect = () => setConnection(true);
    window.addEventListener("connection-required", connect);
    read(api.GET("/api/health"))
      .then((result) => {
        if (active) setHealth(result);
      })
      .catch((error) => {
        if (active) fail(error);
      });
    return () => {
      active = false;
      window.removeEventListener("connection-required", connect);
    };
  }, [refresh, fail, tab]);
  useEffect(() => {
    setError("");
    setEvidenceId(null);
    document.title = `${route.coachStudio ? "Coach studio" : route.gameId ? "Game review" : (tab ?? "Page not found")} · Fieldwork`;
  }, [route, tab]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <div className="header-inner">
          <Link
            className="brand"
            href={pagePaths.Review}
            aria-label="Fieldwork home"
          >
            <img src={appMark} width="34" height="34" alt="" />
            <span className="brand-wordmark">
              fieldwork<span className="brand-sub">Chess training</span>
            </span>
          </Link>
          <nav aria-label="Main navigation">
            {tabs.map(([name, Icon]) => (
              <Link
                key={name}
                href={pagePaths[name]}
                aria-current={tab === name ? "page" : undefined}
                className={
                  tab === name
                    ? "button-link nav-item active"
                    : "button-link nav-item"
                }
              >
                <Icon size={17} strokeWidth={1.7} />
                <span>{name}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className={
          tab === "Review" || (tab === "Games" && route.gameId)
            ? "review-page"
            : "workspace-page"
        }
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
                reloadCoachPreferences();
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
                key={`${refresh}-${route.href}`}
                focusSkill={focusSkill}
                onExitFocus={() => navigate(pagePaths.Review)}
                requested={exercise}
                onImport={() => navigate(pagePaths.Import)}
                fail={fail}
                onEvidence={setEvidenceId}
              />
            )}
            {tab === "Import" && <ImportScreen health={health} fail={fail} />}
            {tab === "Games" && (
              <GamesScreen
                key={route.href}
                page={route.page}
                selected={route.gameId}
                initialPly={route.ply}
              />
            )}
            {tab === "Weaknesses" && (
              <WeaknessScreen
                onPractice={(skill) => {
                  navigate(
                    `${pagePaths.Review}?focus=${encodeURIComponent(skill)}`,
                  );
                }}
                onEvidence={setEvidenceId}
                fail={fail}
              />
            )}
            {tab === "Settings" && (
              <SettingsScreen health={health} fail={fail} />
            )}
            {route.coachStudio && (
              <Suspense
                fallback={<p role="status">Opening the coach studio…</p>}
              >
                <CoachStudio />
              </Suspense>
            )}
            {!tab && !route.coachStudio && (
              <section className="panel">
                <h1>Page not found</h1>
                <p>This address does not match a page in Fieldwork.</p>
                <Link className="button-link primary" href={pagePaths.Games}>
                  Go to your games
                </Link>
              </section>
            )}
          </>
        )}
      </main>
      <footer className="app-footer">
        <span>
          FIELDWORK <span className="footer-divider">/</span> PERSONAL CHESS
          TRAINING
        </span>
        <span>
          <ShieldCheck size={14} />{" "}
          {account
            ? "Games & practice are private to your account"
            : "Games & practice stay on this computer"}
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
