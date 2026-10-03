import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, BookOpen, Clock3, Flag } from "lucide-react";
import { api, read } from "./api";
import ActionLink from "./ActionLink";
import Button from "./Button";
import EmptyState from "./EmptyState";
import GameHistory from "./GameHistory";
import { LoadingState, UnavailableState } from "./LoadState";
import PageTitle from "./PageTitle";
import ResumeLink from "./ResumeLink";
import StatList from "./StatList";
import { insightsPaths, lessonCoursePath, lessonSessionPath, pagePaths, studyPaths } from "./navigation";
import "./home.css";

const loadDue = (signal: AbortSignal) => read(api.GET("/api/review/count", { signal }));
const loadGames = (signal: AbortSignal) => read(api.GET("/api/games", { params: { query: { offset: 0, limit: 4 } }, signal }));
const loadWeaknesses = (signal: AbortSignal) => read(api.GET("/api/weaknesses", { signal }));
const loadLessons = (signal: AbortSignal) => read(api.GET("/api/study/courses", { signal }));
const loadOpenings = (signal: AbortSignal) => read(api.GET("/api/opening-studies", { signal }));

// Each summary can recover independently; leaving Home disposes every request.
function useHomeQuery<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    load(controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [load, attempt]);
  return { data, failed, retry: () => setAttempt(value => value + 1) };
}

function HomeResult<T>({ query, label, children }: {
  query: ReturnType<typeof useHomeQuery<T>>;
  label: string;
  children: (data: T) => ReactNode;
}) {
  if (query.failed) return <UnavailableState actions={<Button variant="secondary" onClick={query.retry}>Try again</Button>}>
    Couldn’t load {label}.
  </UnavailableState>;
  if (query.data === undefined) return <LoadingState>Loading {label}…</LoadingState>;
  return children(query.data);
}

export default function HomeScreen() {
  const due = useHomeQuery(loadDue);
  const games = useHomeQuery(loadGames);
  const weaknesses = useHomeQuery(loadWeaknesses);
  const lessons = useHomeQuery(loadLessons);
  const openings = useHomeQuery(loadOpenings);

  return <>
    <PageTitle eyebrow="YOUR NEXT MOVE" title="Home" />
    <div className="home-dashboard">
      <section className="panel home-due" aria-labelledby="home-due-title">
        <div className="home-section-heading"><h2 id="home-due-title"><Clock3 size={20} aria-hidden="true" />Due now</h2>
          <ActionLink variant="quiet" size="compact" href={pagePaths.Study}>Study overview<ArrowRight size={16} aria-hidden="true" /></ActionLink>
        </div>
        <HomeResult query={due} label="scheduled recalls">{data => <>
          <StatList prominence="featured" items={[{ label: "Scheduled recalls", value: data.due }]} />
          <p className="muted">{data.due > 0 ? "Pick up your practice with the positions ready for recall." : "You’re caught up. Learn a new line or revisit a game."}</p>
          <ActionLink variant="primary" href={data.due > 0 ? studyPaths.due : studyPaths.openings}>
            {data.due > 0 ? "Start studying" : "Explore openings"}<ArrowRight size={16} aria-hidden="true" />
          </ActionLink>
        </>}</HomeResult>
      </section>

      <section className="panel home-learning" aria-labelledby="home-learning-title">
        <div className="home-section-heading"><h2 id="home-learning-title"><BookOpen size={20} aria-hidden="true" />Keep learning</h2>
          <ActionLink variant="quiet" size="compact" href={studyPaths.openings}>Openings<ArrowRight size={16} aria-hidden="true" /></ActionLink>
        </div>
        <HomeResult query={lessons} label="lessons">{data => <div className="study-resume-list">
          {data.resume.length ? data.resume.slice(0, 2).map(session => <ResumeLink key={session.id}
            href={lessonSessionPath(session.id)} description={`Continue · ${session.chapter_title}`}>{session.course_title}</ResumeLink>)
            : data.courses.length ? <ResumeLink href={lessonCoursePath(data.courses[0].id, data.courses[0].revision)}
              description={`${data.courses[0].completed_chapters} of ${data.courses[0].chapter_count} chapters completed`}>
              {data.courses[0].title}
            </ResumeLink> : <EmptyState presentation="compact" title="Choose an opening to study.">
              Browse the catalogue and build your repertoire.
            </EmptyState>}
        </div>}</HomeResult>
        <HomeResult query={openings} label="opening studies">{data => <StatList items={[
          { label: "Active opening lines", value: data.active_studies },
        ]} />}</HomeResult>
      </section>

      <section className="panel home-games" aria-labelledby="home-games-title">
        <div className="home-section-heading"><h2 id="home-games-title"><BookOpen size={20} aria-hidden="true" />Recent games</h2>
          <ActionLink variant="quiet" size="compact" href={pagePaths.Games}>All games<ArrowRight size={16} aria-hidden="true" /></ActionLink>
        </div>
        <HomeResult query={games} label="recent games">{data => data.items.length
          ? <GameHistory items={data.items} page={1} presentation="compact" />
          : <EmptyState presentation="compact" title="Your next insight starts with a game." actions={<ActionLink variant="secondary" href={pagePaths.Settings}>Import games</ActionLink>}>
            Connect Chess.com or Lichess, or bring a PGN.
          </EmptyState>}
        </HomeResult>
      </section>

      <section className="panel home-focus" aria-labelledby="home-focus-title">
        <div className="home-section-heading"><h2 id="home-focus-title"><Flag size={20} aria-hidden="true" />Practice focus</h2>
          <ActionLink variant="quiet" size="compact" href={insightsPaths.patterns}>All weaknesses<ArrowRight size={16} aria-hidden="true" /></ActionLink>
        </div>
        <HomeResult query={weaknesses} label="practice priorities">{data => {
          // Server ordering retains evidence confidence and priority. Patterns can
          // share positions, so their counts must never be added into a total.
          const skills = data.skills.filter(skill => skill.kind === "mechanism" && skill.practice_positions > 0).slice(0, 3);
          return skills.length ? <>
            <div className="study-resume-list">{skills.map(skill => <ResumeLink key={skill.skill_id}
              href={`${studyPaths.due}?focus=${encodeURIComponent(skill.skill_id)}`}
              description={<>{skill.practice_positions} {skill.practice_positions === 1 ? "position" : "positions"} · {skill.independent_games} {skill.independent_games === 1 ? "game" : "games"}{skill.provisional ? " · Early evidence" : ""}</>}>
              {skill.title}
            </ResumeLink>)}</div>
            <p className="small muted">Focused practice leaves your review schedule unchanged.</p>
          </> : <EmptyState presentation="compact" title="No patterns ready to practice yet.">
            Analyze imported games for training in Settings to find supported practice positions.
          </EmptyState>;
        }}</HomeResult>
      </section>
    </div>
  </>;
}
