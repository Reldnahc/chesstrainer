import { api, read, type Schema } from "../api";

/** A course file in the readable format described in docs/COURSE_FILES.md. */
export type CourseFile = Record<string, unknown>;

/** Save the browser a course's file. Uses the API client so LAN tokens still apply. */
export async function downloadCourseFile(courseId: string, revision?: string) {
  const { data } = await api.GET("/api/study/courses/{course_id}/file", {
    params: { path: { course_id: courseId }, query: { revision } },
    parseAs: "blob",
  });
  if (!data) throw new Error("The server returned an empty course file.");
  const url = URL.createObjectURL(data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${courseId}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function fetchCourseFile(courseId: string, revision?: string, signal?: AbortSignal) {
  const { data } = await api.GET("/api/study/courses/{course_id}/file", {
    params: { path: { course_id: courseId }, query: { revision } },
    parseAs: "json",
    signal,
  });
  if (!data || typeof data !== "object") throw new Error("The server returned an empty course file.");
  return data as CourseFile;
}

export function saveCourseFile(file: CourseFile, query: { base_revision?: string; create?: boolean } = {}): Promise<Schema["CourseFileSaved"]> {
  return read(api.POST("/api/study/course-files", { body: file, params: { query } }));
}

/** Read a chosen file as a course file; the server checks everything else. */
export async function readChosenFile(file: File): Promise<CourseFile> {
  const text = await file.text();
  let data: unknown;
  try { data = JSON.parse(text); }
  catch { throw new Error(`${file.name} is not a JSON course file.`); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(`${file.name} is not a JSON course file.`);
  return data as CourseFile;
}

/** Delete a club course file, or hide a built-in course for this install. */
export function deleteCourseFile(courseId: string): Promise<Schema["CourseFileDeleted"]> {
  return read(api.DELETE("/api/study/course-files/{course_id}", { params: { path: { course_id: courseId } } }));
}

export function restoreBuiltInCourse(courseId: string): Promise<Schema["HiddenCourse"]> {
  return read(api.POST("/api/study/course-files/{course_id}/restore", { params: { path: { course_id: courseId } } }));
}

export function savedMessage(saved: Schema["CourseFileSaved"], verb = "Saved") {
  return saved.revision_changed
    ? `${verb} “${saved.title}” as revision ${saved.revision}. Members who already started it keep the version they began.`
    : `${verb} “${saved.title}”.`;
}
