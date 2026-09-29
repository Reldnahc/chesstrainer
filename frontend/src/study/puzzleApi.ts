import { api, read } from "../api";
import { studyRequestId } from "./requestId";

export async function startNextPuzzle(source?: "generic" | "games", signal?: AbortSignal) {
  const next = await read(api.GET("/api/puzzles/next", { params: { query: { source } }, signal }));
  if (!next) return null;
  return read(api.POST("/api/puzzle-sessions", { body: { ...next, request_id: studyRequestId() }, signal }));
}
