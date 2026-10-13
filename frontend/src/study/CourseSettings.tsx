import { useEffect, useRef, useState } from "react";
import { Download, Pencil, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { api, read, type Schema } from "../api";
import ActionLink from "../ActionLink";
import Button from "../Button";
import { LoadingState, UnavailableState } from "../LoadState";
import Notice from "../Notice";
import Reveal from "../Reveal";
import SettingsSection from "../SettingsSection";
import { courseEditorPath } from "../navigation";
import { deleteCourseFile, downloadCourseFile, readChosenFile, restoreBuiltInCourse, saveCourseFile, savedMessage } from "./courseFiles";

/** Administrator course management: write, import, export and delete Study courses. */
export default function CourseSettings() {
  const [library, setLibrary] = useState<Schema["LessonLibrary"] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const chooser = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    read(api.GET("/api/study/courses", { signal: controller.signal }))
      .then(result => { if (!controller.signal.aborted) setLibrary(result); })
      .catch(e => { if (!controller.signal.aborted) setError((e as Error).message); });
    return () => controller.abort();
  }, [reload]);
  async function act(action: () => Promise<string | void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const message = await action();
      if (message) setNotice(message);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function importChosen(file: File | undefined) {
    if (chooser.current) chooser.current.value = "";
    if (!file) return;
    void act(async () => {
      const saved = await saveCourseFile(await readChosenFile(file));
      setReload(value => value + 1);
      return savedMessage(saved, "Imported");
    });
  }
  function remove(course: Schema["LessonCourseSummary"]) {
    setConfirming(null);
    void act(async () => {
      const deleted = await deleteCourseFile(course.id);
      setReload(value => value + 1);
      if (deleted.hidden) return `Deleted “${course.title}”. You can restore it under Deleted built-in courses.`;
      if (deleted.built_in_restored) return `Deleted the club copy of “${course.title}”. The built-in course is back.`;
      return `Deleted “${course.title}”.`;
    });
  }
  function restore(course: Schema["HiddenCourse"]) {
    void act(async () => {
      await restoreBuiltInCourse(course.id);
      setReload(value => value + 1);
      return `Restored “${course.title}”.`;
    });
  }
  if (!library) return error ? <UnavailableState presentation="panel">{error}</UnavailableState> : <LoadingState presentation="panel">Loading courses…</LoadingState>;
  return <SettingsSection id="settings-courses" className="course-settings" title="Courses"
    description="Write Study lessons for your members, or import a course file. Members see every course here in Lessons."
    actions={<div className="button-row">
      <ActionLink variant="primary" href={courseEditorPath()}><Plus size={16} />New course</ActionLink>
      <Button variant="secondary" disabled={busy} onClick={() => chooser.current?.click()}><Upload size={16} />{busy ? "Working…" : "Import course file"}</Button>
      <input ref={chooser} hidden type="file" accept=".json,application/json" aria-label="Course file" onChange={event => importChosen(event.target.files?.[0])} />
    </div>}>
    <Reveal>{notice && <Notice announcement="status" tone="success">{notice}</Notice>}</Reveal>
    <Reveal>{error && <Notice announcement="alert" tone="error">{error}</Notice>}</Reveal>
    {(library.problems ?? []).map(problem => <Notice key={problem.file} announcement="passive" tone="error">Not loaded: {problem.message}</Notice>)}
    {library.courses.map(course => <div className="settings-tool settings-tool-row" key={course.id}>
      <div>
        <h3>{course.title}</h3>
        <p>{course.source === "club" ? "Club course" : "Built-in course"} · {course.topic === "skills" ? "Fundamentals" : "Openings"} · {course.chapter_count} {course.chapter_count === 1 ? "chapter" : "chapters"} · revision {course.revision}</p>
        {confirming === course.id && <p className="small">{course.source === "club"
          ? "Delete this course file? Members stop seeing it; their progress is kept. A built-in course it replaced comes back."
          : "Delete this built-in course? Members stop seeing it; their progress is kept and returns if you restore it."}</p>}
      </div>
      <div className="button-row">
        <ActionLink size="compact" variant="secondary" href={courseEditorPath(course.id)}><Pencil size={16} />Edit</ActionLink>
        <Button size="compact" variant="quiet" disabled={busy} onClick={() => act(() => downloadCourseFile(course.id, course.revision))}><Download size={16} />Download</Button>
        {confirming === course.id
          ? <><Button size="compact" variant="secondary" disabled={busy} onClick={() => remove(course)}><Trash2 size={16} />Delete for everyone</Button>
            <Button size="compact" variant="quiet" onClick={() => setConfirming(null)}>Keep it</Button></>
          : <Button size="compact" variant="quiet" disabled={busy} onClick={() => setConfirming(course.id)}><Trash2 size={16} />Delete</Button>}
      </div>
    </div>)}
    {(library.hidden_built_ins ?? []).length > 0 && <>
      <h3 className="course-settings-group">Deleted built-in courses</h3>
      {(library.hidden_built_ins ?? []).map(course => <div className="settings-tool settings-tool-row" key={course.id}>
        <div>
          <h3>{course.title}</h3>
          <p>Built-in course · hidden from members</p>
        </div>
        <div className="button-row">
          <Button size="compact" variant="secondary" disabled={busy} onClick={() => restore(course)}><RotateCcw size={16} />Restore</Button>
        </div>
      </div>)}
    </>}
    <p className="small muted">Editing a built-in course saves a club copy that replaces it; deleting that copy brings the built-in course back. Deleting a built-in course hides it until you restore it. Members who started a course keep the version they began, and deleting a course never deletes their progress.</p>
  </SettingsSection>;
}
