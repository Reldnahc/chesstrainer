import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check } from "lucide-react";
import { api, read, type Schema } from "../api";
import Link from "../Link";
import { lessonCoursePath, lessonSessionPath, navigate, studyPaths } from "../navigation";
import { studyRequestId } from "./requestId";
import LessonAttribution from "./LessonAttribution";

export default function LessonLibrary({ courseId, revision }: { courseId: string | null; revision: string | null }) {
  const [library, setLibrary] = useState<Schema["LessonLibrary"] | null>(null);
  const [course, setCourse] = useState<Schema["LessonCourseView"] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (courseId) {
      read(api.GET("/api/study/courses/{course_id}", { params: { path: { course_id: courseId }, query: { revision: revision || undefined } }, signal: controller.signal }))
        .then(result => { if (!controller.signal.aborted) setCourse(result); })
        .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    } else {
      read(api.GET("/api/study/courses", { signal: controller.signal }))
        .then(result => { if (!controller.signal.aborted) setLibrary(result); })
        .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    }
    return () => { controller.abort(); request.current?.abort(); };
  }, [courseId, revision]);
  async function begin(chapterId: string) {
    if (!course || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(chapterId);
    setError("");
    try {
      const session = await read(api.POST("/api/study/lesson-sessions", {
        body: { course_id: course.id, course_revision: course.revision, chapter_id: chapterId, request_id: studyRequestId() }, signal: controller.signal,
      }));
      if (!controller.signal.aborted) navigate(lessonSessionPath(session.id));
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) { setBusy(null); request.current = null; } }
  }
  if (courseId) return <section className="panel lesson-course">
    <Link className="text-button button-link" href={studyPaths.openings}><ArrowLeft size={16} />All openings</Link>
    {error && <p className="notice error" role="alert">{error}</p>}
    {course ? <>
      <div className="lesson-course-title"><BookOpen size={26} aria-hidden="true" /><div><h2>{course.title}</h2><span className="muted">Study as {course.learner_color === "white" ? "White" : "Black"}</span></div></div>
      <p>{course.description}</p>
      <ol className="lesson-chapters">{course.chapters.map((chapter, index) => <li key={chapter.id}>
        <span className="lesson-chapter-number">{chapter.completed ? <Check size={18} aria-label="Completed" /> : index + 1}</span>
        <div><h3>{chapter.title}</h3><span className="muted">{chapter.completed ? "Completed · revisit any time" : "Guided lesson"}</span></div>
        <button className={chapter.completed ? "secondary" : "primary"} disabled={!!busy} onClick={() => begin(chapter.id)}>{busy === chapter.id ? "Opening…" : chapter.completed ? "Revisit" : "Start"}<ArrowRight size={16} /></button>
      </li>)}</ol>
      <LessonAttribution attributions={course.attributions} />
    </> : !error && <p role="status">Loading lesson chapters…</p>}
  </section>;
  if (!library) return <section className="panel">{error ? <p role="alert">{error}</p> : <p role="status">Loading opening lessons…</p>}</section>;
  return <>
    {!!library.resume.length && <section className="panel"><h2>Continue learning</h2><div className="study-resume-list">{library.resume.map(session => <Link className="study-resume" key={session.id} href={lessonSessionPath(session.id)}><span>{session.course_title}<small>{session.chapter_title}</small></span><ArrowRight size={18} /></Link>)}</div></section>}
    {library.courses.length ? <div className="lesson-course-grid">{library.courses.map(item => <Link key={`${item.id}:${item.revision}`} className="panel lesson-course-card" href={lessonCoursePath(item.id, item.revision)}><BookOpen size={22} aria-hidden="true" /><h2>{item.title}</h2><p>{item.description}</p><span>Study as {item.learner_color === "white" ? "White" : "Black"}<ArrowRight size={16} /></span></Link>)}</div>
      : <section className="panel study-empty"><BookOpen size={28} aria-hidden="true" /><h2>No opening lessons yet.</h2><p>Opening lessons will appear here when a course is available.</p><Link className="button-link secondary" href={studyPaths.due}>Go to Due</Link></section>}
  </>;
}
