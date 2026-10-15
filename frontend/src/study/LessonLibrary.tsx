import { useState } from "react";
import Banner from "../Banner";
import { ArrowLeft, ArrowRight, BookOpen, Check, Download } from "lucide-react";
import { errorMessage, api, read, type Schema } from "../api";
import Link from "../Link";
import ResumeLink from "../ResumeLink";
import EmptyState from "../EmptyState";
import ActionLink from "../ActionLink";
import Button from "../Button";
import { courseLinePath, lessonCoursePath, lessonSessionPath, navigate, studyPaths, type LessonTopic } from "../navigation";
import { retryableStart } from "./retryableStart";
import LessonAttribution from "./LessonAttribution";
import { downloadCourseFile } from "./courseFiles";
import { QueryResult, useCommand, useQuery } from "../useQuery";

type Course = Schema["LessonCourseView"];
type CourseSummary = Schema["LessonLibrary"]["courses"][number];

function ChapterRow({ chapter, index, busy, onStart }: {
  chapter: Course["chapters"][number]; index: number; busy: string | null; onStart: () => void;
}) {
  return <li>
    <span className="lesson-chapter-number">{chapter.completed ? <Check size={18} aria-label="Completed" /> : index + 1}</span>
    <div><h3>{chapter.title}</h3><span className="muted">{chapter.completed ? "Completed · revisit any time" : "Guided lesson"}</span></div>
    <Button size="compact" variant={chapter.completed ? "secondary" : "primary"} disabled={!!busy} onClick={onStart}>
      {busy === chapter.id ? "Opening…" : chapter.completed ? "Revisit" : "Start"}<ArrowRight size={16} />
    </Button>
  </li>;
}

function CourseCard({ course, topic }: { course: CourseSummary; topic: LessonTopic }) {
  return <Link className="panel panel--card lesson-course-card" href={lessonCoursePath(course.id, course.revision, topic)}>
    <BookOpen size={22} aria-hidden="true" />
    <h2>{course.title}</h2>
    <p>{course.description}</p>
    <span>Study as {course.learner_color === "white" ? "White" : "Black"}{course.source === "club" ? " · Club course" : ""}<ArrowRight size={16} /></span>
  </Link>;
}

const TOPIC_TEXT = {
  opening: { home: studyPaths.openings, back: "All openings", label: "opening lessons", empty: "No opening lessons yet.", emptyText: "Opening lessons will appear here when a course is available." },
  skills: { home: studyPaths.skills, back: "All fundamentals", label: "fundamentals lessons", empty: "No fundamentals lessons yet.", emptyText: "Fundamentals lessons will appear here when a course is available." },
} as const;

export default function LessonLibrary({ topic, courseId, revision }: { topic: LessonTopic; courseId: string | null; revision: string | null }) {
  // Another course is another page: it loads fresh instead of showing the last course's chapters.
  if (courseId) return <CoursePage key={`${courseId}:${revision ?? ""}`} topic={topic} courseId={courseId} revision={revision} />;
  return <Library topic={topic} />;
}

function CoursePage({ topic, courseId, revision }: { topic: LessonTopic; courseId: string; revision: string | null }) {
  const query = useQuery(signal => read(api.GET("/api/study/courses/{course_id}", {
    params: { path: { course_id: courseId }, query: { revision: revision || undefined } }, signal,
  })));
  const course = query.data;
  const [error, setError] = useState("");
  const start = useCommand<string>();
  const [downloading, setDownloading] = useState(false);
  const [startLesson] = useState(() => retryableStart(
    async (body: Omit<Schema["LessonStart"], "request_id">) => body,
    (body, signal) => read(api.POST("/api/study/lesson-sessions", { body, signal })),
  ));
  async function download() {
    if (!course || downloading) return;
    setDownloading(true);
    setError("");
    try { await downloadCourseFile(course.id, course.revision); }
    catch (e) { setError(errorMessage(e)); }
    finally { setDownloading(false); }
  }
  function begin(chapterId: string) {
    if (!course) return;
    void start.run(chapterId,
      (signal) => startLesson({ course_id: course.id, course_revision: course.revision, chapter_id: chapterId }, signal),
      (session) => { if (session) navigate(lessonSessionPath(session.id, session.course_topic)); });
  }
  // A course page follows its course's own topic, so an older link still
  // returns to the section that lists the course.
  const courseText = TOPIC_TEXT[course?.topic ?? topic];
  return <section className="panel lesson-course">
    <ActionLink variant="quiet" href={courseText.home}><ArrowLeft size={16} />{courseText.back}</ActionLink>
    {error && <Banner tone="error" onDismiss={() => setError("")}>{error}</Banner>}
    {start.error && <Banner tone="error" onDismiss={start.dismiss}>{start.error}</Banner>}
    <QueryResult query={query} label="the course">{course => <>
      <header className="lesson-course-title">
        <BookOpen size={26} aria-hidden="true" />
        <div>
          <h2>{course.title}</h2>
          <span className="muted">Study as {course.learner_color === "white" ? "White" : "Black"}</span>
          <p>{course.description}</p>
        </div>
      </header>
      <ol className="lesson-chapters">{course.chapters.map((chapter, index) =>
        <ChapterRow key={chapter.id} chapter={chapter} index={index} busy={start.busy} onStart={() => begin(chapter.id)} />)}</ol>
      {course.lines.some(line => line.repertoire) && <section className="lesson-repertoire-lines" aria-label="Course recall lines"><h3>Keep these lines in memory</h3><p className="small muted">Adding a line is optional. Lesson completion does not enroll it automatically.</p>{course.lines.filter(line => line.repertoire).map(line => <ResumeLink href={courseLinePath(course.id, line.id, course.revision, course.learner_color)} key={line.id} description="Preview and add to study">{line.title}</ResumeLink>)}</section>}
      <LessonAttribution attributions={course.attributions} />
      <Button className="lesson-course-download" size="compact" variant="quiet" disabled={downloading} onClick={download}><Download size={16} />Download course file</Button>
    </>}</QueryResult>
  </section>;
}

function Library({ topic }: { topic: LessonTopic }) {
  const text = TOPIC_TEXT[topic];
  const query = useQuery(signal => read(api.GET("/api/study/courses", { signal })));
  return <QueryResult query={query} label={text.label} presentation="panel">{library => {
    const resume = library.resume.filter(session => session.course_topic === topic);
    const courses = library.courses.filter(item => item.topic === topic);
    return <>
      {!!resume.length && <section className="panel"><h2>Continue learning</h2><div className="study-resume-list">{resume.map(session => <ResumeLink key={session.id} href={lessonSessionPath(session.id, topic)} description={session.chapter_title}>{session.course_title}</ResumeLink>)}</div></section>}
      {courses.length ? <div className="lesson-course-grid">{courses.map(item => <CourseCard key={`${item.id}:${item.revision}`} course={item} topic={topic} />)}</div>
        : <EmptyState title={text.empty} icon={<BookOpen />} actions={<ActionLink variant="secondary" href={studyPaths.due}>Go to Due</ActionLink>}>{text.emptyText}</EmptyState>}
    </>;
  }}</QueryResult>;
}
