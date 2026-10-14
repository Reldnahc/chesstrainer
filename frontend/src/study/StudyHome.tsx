import { ArrowRight, Clock3, GraduationCap, Puzzle } from "lucide-react";
import { api, read } from "../api";
import ActionLink from "../ActionLink";
import Banner from "../Banner";
import Button from "../Button";
import PageTitle from "../PageTitle";
import StatList from "../StatList";
import { studyPaths } from "../navigation";
import { useQuery } from "../useQuery";

const plural = (count: number | undefined, one: string, many: string) => (count === 1 ? one : many);

/** Study's overview: what is due, what is left to learn and the puzzles waiting.
 * Each card loads only its own count. */
export default function StudyHome() {
  const due = useQuery((signal) => read(api.GET("/api/review/count", { signal })));
  const lessons = useQuery((signal) => read(api.GET("/api/study/courses", { signal })));
  const puzzles = useQuery((signal) => read(api.GET("/api/puzzles", { signal })));
  const chapters = lessons.data?.courses.reduce((sum, course) => sum + course.chapter_count - course.completed_chapters, 0);
  const library = puzzles.data;
  const unsolved = library ? Math.max(0, library.available - library.solved_puzzles) : undefined;
  const gamesCount = library?.generation?.puzzles ?? 0;
  const failed = [due, lessons, puzzles].filter((query) => query.error);
  const count = (value: number | undefined) => value ?? "—";
  return <>
    <PageTitle title="Study" />
    <div className="study-page">
      {failed.length > 0 && (
        <Banner tone="error" action={<Button size="compact" onClick={() => failed.forEach((query) => query.retry())}>Try again</Button>}>
          {failed[0].error}
        </Banner>
      )}
      <div className="study-options">
        <section className="panel study-option study-due">
          <Clock3 aria-hidden="true" size={22} />
          <h2>Due now</h2>
          <p>{due.data?.due ? "Return to decisions worth remembering." : "Your scheduled recalls will appear here when they’re due."}</p>
          <StatList prominence="featured" items={[{ label: "Scheduled recalls", value: count(due.data?.due) }]} />
          <ActionLink variant="primary" href={studyPaths.due}>Start studying <ArrowRight size={16} /></ActionLink>
        </section>
        <section className="panel study-option">
          <GraduationCap aria-hidden="true" size={22} /><h2>Lessons</h2>
          <p>Learn openings, tactics and the fundamentals, then choose what to remember.</p>
          <StatList prominence="featured" items={[{ label: plural(chapters, "Chapter to learn", "Chapters to learn"), value: count(chapters) }]} />
          <ActionLink variant="secondary" href={studyPaths.openings}>Open lessons <ArrowRight size={16} /></ActionLink>
        </section>
        <section className="panel study-option">
          <Puzzle aria-hidden="true" size={22} /><h2>Puzzles</h2>
          <p>{!library ? "Calculation practice from installed collections." : library.available
            ? `${library.solved_puzzles} ${plural(library.solved_puzzles, "puzzle", "puzzles")} solved.${gamesCount ? ` ${gamesCount} from your own games.` : ""}` : "No puzzle collections are installed yet."}</p>
          <StatList prominence="featured" items={[{ label: plural(unsolved, "Unsolved puzzle", "Unsolved puzzles"), value: count(unsolved) }]} />
          <ActionLink variant="secondary" href={studyPaths.puzzles}>{library?.resume.length ? "Continue puzzles" : "Open puzzles"} <ArrowRight size={16} /></ActionLink>
        </section>
      </div>
    </div>
  </>;
}
