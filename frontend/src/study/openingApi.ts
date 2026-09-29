import { api, read } from "../api";
import { retryableStart } from "./retryableStart";

export function setStudyActive(id: string, active: boolean, signal?: AbortSignal) {
  return active
    ? read(api.POST("/api/opening-studies/{study_id}/restore", { params: { path: { study_id: id } }, signal }))
    : read(api.DELETE("/api/opening-studies/{study_id}", { params: { path: { study_id: id } }, signal }));
}
export function createPracticeStarter() {
  return retryableStart(
    async (id: string) => ({ id }),
    ({ id, request_id }, signal) => read(api.POST("/api/opening-studies/{study_id}/practice", {
      params: { path: { study_id: id } }, body: { request_id }, signal,
    })),
  );
}
