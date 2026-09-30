import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  BookOpen,
  Flag,
  Focus,
  House,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { api, read, type Health } from "./api";
import ReviewScreen from "./Review";
import GamesScreen from "./GameReview";
import SettingsScreen from "./Settings";
import WeaknessScreen from "./Weaknesses";
import HomeScreen from "./Home";
import EvidenceDialog from "./EvidenceDialog";
import { pagePaths, useRoute } from "./navigation";
import StudyScreen from "./study/StudyScreen";
import PuzzlePlayer from "./study/PuzzlePlayer";
import LessonPlayer from "./study/LessonPlayer";
import OpeningLinePreview from "./study/OpeningLinePreview";
import Link from "./Link";
import Button, { IconButton } from "./Button";
import ActionLink from "./ActionLink";
import Notice from "./Notice";
import appMark from "./assets/fieldwork.svg";
import { useAccount } from "./AccountGate";
import { useCoachPreferences } from "./coach/CoachProvider";
import { useMotionPreferences } from "./MotionProvider";
const tabs = [
  ["Home", House],
  ["Study", Focus],
  ["Games", BookOpen],
  ["Weaknesses", Flag],
  ["Settings", Settings2],
] as const;
export default function App() {
  const account = useAccount();
  const { retry: reloadCoachPreferences } = useCoachPreferences();
  const { retry: reloadMotionPreferences } = useMotionPreferences();
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
  }, [route]);
  // Set the route fallback before child effects apply a more specific title.
  useLayoutEffect(() => {
    document.title = `${route.gameId ? "Game review" : route.studyMode === "due" ? focusSkill ? "Focused practice" : "Due" : (tab ?? "Page not found")} · Fieldwork`;
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
            href={pagePaths.Home}
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
          route.studyMode === "due" || route.puzzleSessionId || route.lessonSessionId || route.openingCatalogueKey || route.openingCourseLine || (tab === "Games" && route.gameId)
            ? "review-page"
            : "workspace-page"
        }
      >
        {error && (
          <Notice announcement="alert" tone="error" actions={<IconButton
              variant="quiet"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={18} />
            </IconButton>}>
            {error}
          </Notice>
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
                reloadMotionPreferences();
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
              <Button type="submit" variant="primary">Connect</Button>
            </form>
          </section>
        ) : (
          <>
            {tab === "Home" && <HomeScreen key={refresh} />}
            {route.studyMode === "due" && (
              <ReviewScreen
                key={`${refresh}-${route.href}`}
                focusSkill={focusSkill}
                requested={exercise}
                requestedSession={route.reviewSessionId}
                fail={fail}
                onEvidence={setEvidenceId}
              />
            )}
            {tab === "Study" && route.studyMode !== "due" && !route.puzzleSessionId && !route.lessonSessionId && !route.openingCatalogueKey && !route.openingCourseLine && (
              <StudyScreen key={`${refresh}-${route.href}`} mode={route.studyMode || "home"} source={route.puzzleSource} courseId={route.lessonCourseId} courseRevision={route.lessonRevision} openingSection={route.openingSection} openingQuery={route.openingQuery} openingEco={route.openingEco} openingOffset={route.openingOffset} />
            )}
            {route.puzzleSessionId && (
              <PuzzlePlayer key={`${refresh}-${route.puzzleSessionId}`} sessionId={route.puzzleSessionId} />
            )}
            {route.lessonSessionId && (
              <LessonPlayer key={`${refresh}-${route.lessonSessionId}`} sessionId={route.lessonSessionId} />
            )}
            {(route.openingCatalogueKey || route.openingCourseLine) && <OpeningLinePreview key={`${refresh}-${route.href}`} catalogueKey={route.openingCatalogueKey} courseLine={route.openingCourseLine} />}
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
                onEvidence={setEvidenceId}
                category={route.weaknessCategory}
              />
            )}
            {tab === "Settings" && (
              <SettingsScreen health={health} fail={fail} section={route.settingsTab} importSource={route.importSource} restoringScroll={route.restoringScroll} />
            )}
            {!tab && (
              <section className="panel">
                <h1>Page not found</h1>
                <p>This address does not match a page in Fieldwork.</p>
                <ActionLink variant="primary" href={pagePaths.Games}>
                  Go to your games
                </ActionLink>
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
