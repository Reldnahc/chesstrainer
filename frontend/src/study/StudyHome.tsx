import { ArrowRight, Clock3, GraduationCap, Puzzle } from "lucide-react";
import { api, read } from "../api";
import ActionLink from "../ActionLink";
import PageTitle from "../PageTitle";
import StatList from "../StatList";
import { plural, pluralWord } from "../format";
import { studyPaths } from "../navigation";
import { QueryError, useQuery } from "../useQuery";

// A label that agrees with a count shown beside it ("Chapter to learn" next to 1).
const label = (count: number | undefined, one: string, many: string) => pluralWord(count ?? 0, one, many);

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
  const count = (value: number | undefined) => value ?? "—";
  return <>
    <PageTitle title="Study" />
    <div className="study-page">
      <QueryError query={due} label="your due count" />
      <QueryError query={lessons} label="your lessons" />
      <QueryError query={puzzles} label="your puzzles" />
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
          <StatList prominence="featured" items={[{ label: label(chapters, "Chapter to learn", "Chapters to learn"), value: count(chapters) }]} />
          <ActionLink variant="secondary" href={studyPaths.openings}>Open lessons <ArrowRight size={16} /></ActionLink>
        </section>
        <section className="panel study-option">
          <Puzzle aria-hidden="true" size={22} /><h2>Puzzles</h2>
          <p>{!library ? "Calculation practice from installed collections." : library.available
            ? `${plural(library.solved_puzzles, "puzzle")} solved.${gamesCount ? ` ${gamesCount} from your own games.` : ""}` : "No puzzle collections are installed yet."}</p>
          <StatList prominence="featured" items={[{ label: label(unsolved, "Unsolved puzzle", "Unsolved puzzles"), value: count(unsolved) }]} />
          <ActionLink variant="secondary" href={studyPaths.puzzles}>{library?.resume.length ? "Continue puzzles" : "Open puzzles"} <ArrowRight size={16} /></ActionLink>
        </section>
      </div>
    </div>
  </>;
}
