import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { setFallbackTitle } from "./PageTitle";
import {
  BookOpen,
  ChartColumn,
  Focus,
  House,
  LockKeyhole,
  LogIn,
  Settings2,
  ShieldCheck,
  Swords,
} from "lucide-react";
import { errorMessage, LAN_TOKEN_KEY, onAuthRequired } from "./api";
import ReviewScreen from "./Review";
import GamesScreen from "./GameReview";
import SettingsScreen from "./Settings";
import InsightsScreen from "./Weaknesses";
import HomeScreen from "./Home";
import EvidenceDialog from "./EvidenceDialog";
import DialogPresence from "./DialogPresence";
import { gamesPath, pagePaths, useRoute, useScrollRestoration, type Screen as RouteScreen } from "./navigation";
import StudyHome from "./study/StudyHome";
import LessonsScreen from "./study/LessonsScreen";
import PuzzleLibrary from "./study/PuzzleLibrary";
import LessonEditor from "./study/LessonEditor";
import PlayScreen from "./play/PlayScreen";
import PuzzlePlayer from "./study/PuzzlePlayer";
import LessonPlayer from "./study/LessonPlayer";
import OpeningLinePreview from "./study/OpeningLinePreview";
import Link from "./Link";
import Button from "./Button";
import ActionLink from "./ActionLink";
import Banner, { BannerOutlet } from "./Banner";
import WelcomeBack from "./WelcomeBack";
import appMark from "./assets/fieldwork.svg";
import { useAccount, useGuestSignIn } from "./accountContext";
import { useCoachPreferences } from "./coach/CoachProvider";
import { useMotionPreferences } from "./MotionProvider";
import { useAudioPreferences } from "./audio/AudioProvider";
const tabs = [
  ["Home", House],
  ["Study", Focus],
  ["Play", Swords],
  ["Games", BookOpen],
  ["Insights", ChartColumn],
  ["Settings", Settings2],
] as const;
export default function App() {
  const account = useAccount();
  // A signed-out visitor sees only the shared game review they were linked to.
  const guestSignIn = useGuestSignIn();
  const guest = !!guestSignIn;
  const { retry: reloadCoachPreferences } = useCoachPreferences();
  const { retry: reloadMotionPreferences } = useMotionPreferences();
  const { retry: reloadAudioPreferences } = useAudioPreferences();
  const route = useRoute();
  useScrollRestoration();
  const { tab, screen } = route;
  // An error belongs to the page it happened on. It is dropped in the same render
  // that shows the next page, so it never appears there and then collapses away.
  const [failure, setFailure] = useState<{ route: typeof route; message: string } | null>(null);
  const error = failure?.route === route ? failure.message : "";
  const currentRoute = useRef(route);
  useLayoutEffect(() => { currentRoute.current = route; }, [route]);
  const setError = useCallback((message: string) =>
    setFailure(message ? { route: currentRoute.current, message } : null), []);
  const [connection, setConnection] = useState(false);
  const [token, setToken] = useState("");
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const fail = useCallback((e: unknown) => setError(errorMessage(e)), [setError]);
  // A LAN install without its access token asks for it in place of the page.
  useEffect(() => (guest ? undefined : onAuthRequired("connection", () => setConnection(true))), [guest]);
  useEffect(() => {
    setError("");
    setEvidenceId(null);
  }, [route, setError]);
  // Set the route fallback before child effects apply a more specific title.
  useLayoutEffect(() => {
    setFallbackTitle(screenTitle(screen) ?? tab ?? "Page not found");
  }, [screen, tab]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <div className={guest ? "header-inner header-inner--guest" : "header-inner"}>
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
          {guestSignIn ? (
            <Button className="guest-sign-in" onClick={guestSignIn}>
              <LogIn size={17} strokeWidth={1.7} />
              Sign in
            </Button>
          ) : <nav aria-label="Main navigation">
            {tabs.map(([name, Icon]) => (
              <Link
                key={name}
                href={name === "Games" && screen.kind === "games" && screen.gameId ? gamesPath(screen.page) : pagePaths[name]}
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
          </nav>}
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className={
          boardPage(screen) ? "review-page" : "workspace-page"
        }
      >
        <BannerOutlet page={route.href.split("?")[0]} />
        {error && <Banner tone="error" onDismiss={() => setError("")}>{error}</Banner>}
        {!connection && !guestSignIn && <WelcomeBack />}
        {connection ? (
          <section className="panel connection">
            <LockKeyhole />
            <h1>Connect to your workspace</h1>
            <p>Enter the LAN token configured on your host computer.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sessionStorage.setItem(LAN_TOKEN_KEY, token);
                reloadCoachPreferences();
                reloadMotionPreferences();
                reloadAudioPreferences();
                // The page's screen mounts again in place of this form, so it loads afresh.
                setConnection(false);
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
          <Screen screen={screen} href={route.href} restoringScroll={route.restoringScroll} fail={fail} onEvidence={setEvidenceId} />
        )}
      </main>
      <footer className="app-footer">
        <span>
          FIELDWORK <span className="footer-divider">/</span> PERSONAL CHESS
          TRAINING
        </span>
        <span>
          <ShieldCheck size={14} />{" "}
          {guestSignIn
            ? "A game review shared by its owner"
            : account
            ? "Your library & practice are private to your account"
            : "Games & practice stay on this computer"}
        </span>
      </footer>
      <DialogPresence>{evidenceId && (
        <EvidenceDialog
          id={evidenceId}
          onClose={() => setEvidenceId(null)}
        />
      )}</DialogPresence>
    </>
  );
}

// Board pages lay out the board and its sidebar; every other screen is a workspace page.
function boardPage(screen: RouteScreen): boolean {
  switch (screen.kind) {
    case "due": case "puzzle-session": case "lesson-session": case "line-preview": case "play": return true;
    case "games": return !!screen.gameId;
    default: return false;
  }
}

// The page title before a screen sets its own; null uses the tab's name.
function screenTitle(screen: RouteScreen): string | null {
  if (screen.kind === "games" && screen.gameId) return "Game review";
  if (screen.kind === "due") return screen.focusSkill ? "Focused practice" : "Due";
  return null;
}

/** The one screen a route shows. Screens keyed by address start afresh when it changes. */
function Screen({ screen, href, restoringScroll, fail, onEvidence }: {
  screen: RouteScreen; href: string; restoringScroll: boolean;
  fail: (e: unknown) => void; onEvidence: (id: string) => void;
}) {
  switch (screen.kind) {
    case "home":
      return <HomeScreen />;
    case "due":
      return <ReviewScreen key={href} focusSkill={screen.focusSkill} requested={screen.exercise}
        requestedSession={screen.sessionId} fail={fail} onEvidence={onEvidence} />;
    case "study-home":
      return <StudyHome />;
    case "lessons":
      return <LessonsScreen key={href} section={screen.section} courseId={screen.courseId} revision={screen.revision}
        query={screen.query} eco={screen.eco} offset={screen.offset} />;
    case "puzzles":
      return <PuzzleLibrary key={href} source={screen.source} />;
    case "course-editor":
      return <LessonEditor key={href} courseId={screen.courseId} revision={screen.revision} />;
    case "puzzle-session":
      return <PuzzlePlayer key={screen.id} sessionId={screen.id} />;
    case "lesson-session":
      return <LessonPlayer key={screen.id} sessionId={screen.id} />;
    case "line-preview":
      return <OpeningLinePreview key={href} catalogueKey={screen.catalogueKey} courseLine={screen.courseLine} />;
    case "play":
      return <PlayScreen key={href} gameId={screen.gameId} from={screen.from} />;
    case "games":
      return <GamesScreen key={href} page={screen.page} selected={screen.gameId} initialPly={screen.ply} />;
    case "insights":
      return <InsightsScreen onEvidence={onEvidence} category={screen.section} />;
    case "settings":
      return <SettingsScreen fail={fail} section={screen.section} importSource={screen.importSource} restoringScroll={restoringScroll} />;
    case "not-found":
      return (
        <section className="panel">
          <h1>Page not found</h1>
          <p>This address does not match a page in Fieldwork.</p>
          <ActionLink variant="primary" href={pagePaths.Games}>
            Go to your games
          </ActionLink>
        </section>
      );
  }
}
