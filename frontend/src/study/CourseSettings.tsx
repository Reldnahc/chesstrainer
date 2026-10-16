import { useRef, useState } from "react";
import Banner from "../Banner";
import { Download, Pencil, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { api, read, type Schema } from "../api";
import ActionLink from "../ActionLink";
import Button from "../Button";
import Notice from "../Notice";
import Reveal, { RevealList, Swap } from "../Reveal";
import SettingsSection from "../SettingsSection";
import { courseEditorPath } from "../navigation";
import { CommandError, QueryResult, useCommand, useQuery } from "../useQuery";
import {
  deleteCourseFile,
  downloadCourseFile,
  readChosenFile,
  restoreBuiltInCourse,
  saveCourseFile,
  savedMessage,
} from "./courseFiles";
import { plural } from "../format";

/** Administrator course management: write, import, export and delete Study courses. */
export default function CourseSettings() {
  const query = useQuery(signal => read(api.GET("/api/study/courses", { signal })));
  const command = useCommand();
  const busy = !!command.busy;
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const chooser = useRef<HTMLInputElement>(null);
  function act(action: () => Promise<string | void>) {
    setNotice("");
    void command.run(true, action, message => {
      if (message) setNotice(message);
    });
  }
  function importChosen(file: File | undefined) {
    if (chooser.current) chooser.current.value = "";
    if (!file) return;
    void act(async () => {
      const saved = await saveCourseFile(await readChosenFile(file));
      query.retry();
      return savedMessage(saved, "Imported");
    });
  }
  function remove(course: Schema["LessonCourseSummary"]) {
    setConfirming(null);
    void act(async () => {
      const deleted = await deleteCourseFile(course.id);
      query.retry();
      if (deleted.hidden)
        return `Deleted “${course.title}”. You can restore it under Deleted built-in courses.`;
      if (deleted.built_in_restored)
        return `Deleted the club copy of “${course.title}”. The built-in course is back.`;
      return `Deleted “${course.title}”.`;
    });
  }
  function restore(course: Schema["HiddenCourse"]) {
    void act(async () => {
      await restoreBuiltInCourse(course.id);
      query.retry();
      return `Restored “${course.title}”.`;
    });
  }
  return (
    <QueryResult query={query} label="courses" presentation="panel">
      {library => (
        <SettingsSection
          id="settings-courses"
          className="course-settings"
          title="Courses"
          stackActions
          description="Write Study lessons for your members, or import a course file. Members see every course here in Lessons."
          actions={
            <div className="button-row">
              <ActionLink variant="primary" href={courseEditorPath()}>
                <Plus size={16} />
                New course
              </ActionLink>
              <Button variant="secondary" disabled={busy} onClick={() => chooser.current?.click()}>
                <Upload size={16} />
                {busy ? "Working…" : "Import course file"}
              </Button>
              <input
                ref={chooser}
                hidden
                type="file"
                accept=".json,application/json"
                aria-label="Course file"
                onChange={event => importChosen(event.target.files?.[0])}
              />
            </div>
          }
        >
          {notice && (
            <Banner tone="success" onDismiss={() => setNotice("")}>
              {notice}
            </Banner>
          )}
          <CommandError command={command} />
          <RevealList>
            {(library.problems ?? []).map(problem => (
              <Notice key={problem.file} announcement="passive" tone="error">
                Not loaded: {problem.message}
              </Notice>
            ))}
          </RevealList>
          <RevealList>
            {library.courses.map(course => (
              <div className="settings-tool settings-tool-row" key={course.id}>
                <div>
                  <h3>{course.title}</h3>
                  <p>
                    {course.source === "club" ? "Club course" : "Built-in course"} ·{" "}
                    {course.topic === "skills" ? "Fundamentals" : "Openings"} ·{" "}
                    {plural(course.chapter_count, "chapter")} · revision {course.revision}
                  </p>
                  <Reveal>
                    {confirming === course.id && (
                      <p className="small">
                        {course.source === "club"
                          ? "Delete this course file? Members stop seeing it; their progress is kept. A built-in course it replaced comes back."
                          : "Delete this built-in course? Members stop seeing it; their progress is kept and returns if you restore it."}
                      </p>
                    )}
                  </Reveal>
                </div>
                <div className="button-row">
                  <ActionLink size="compact" variant="secondary" href={courseEditorPath(course.id)}>
                    <Pencil size={16} />
                    Edit
                  </ActionLink>
                  <Button
                    size="compact"
                    variant="quiet"
                    disabled={busy}
                    onClick={() => act(() => downloadCourseFile(course.id, course.revision))}
                  >
                    <Download size={16} />
                    Download
                  </Button>
                  <Swap axis="inline">
                    {confirming === course.id ? (
                      <div className="button-row" key="confirm">
                        <Button
                          size="compact"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => remove(course)}
                        >
                          <Trash2 size={16} />
                          Delete for everyone
                        </Button>
                        <Button size="compact" variant="quiet" onClick={() => setConfirming(null)}>
                          Keep it
                        </Button>
                      </div>
                    ) : (
                      <div className="button-row" key="delete">
                        <Button
                          size="compact"
                          variant="quiet"
                          disabled={busy}
                          onClick={() => setConfirming(course.id)}
                        >
                          <Trash2 size={16} />
                          Delete
                        </Button>
                      </div>
                    )}
                  </Swap>
                </div>
              </div>
            ))}
          </RevealList>
          <Reveal>
            {(library.hidden_built_ins ?? []).length > 0 && (
              <div className="stack">
                <h3 className="course-settings-group">Deleted built-in courses</h3>
                <RevealList>
                  {(library.hidden_built_ins ?? []).map(course => (
                    <div className="settings-tool settings-tool-row" key={course.id}>
                      <div>
                        <h3>{course.title}</h3>
                        <p>Built-in course · hidden from members</p>
                      </div>
                      <div className="button-row">
                        <Button
                          size="compact"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => restore(course)}
                        >
                          <RotateCcw size={16} />
                          Restore
                        </Button>
                      </div>
                    </div>
                  ))}
                </RevealList>
              </div>
            )}
          </Reveal>
          <p className="small muted">
            Editing a built-in course saves a club copy that replaces it; deleting that copy brings
            the built-in course back. Deleting a built-in course hides it until you restore it.
            Members who started a course keep the version they began, and deleting a course never
            deletes their progress.
          </p>
        </SettingsSection>
      )}
    </QueryResult>
  );
}
