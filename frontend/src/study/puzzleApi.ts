import { api, read } from "../api";
import { retryableStart } from "./retryableStart";

export function createPuzzleStarter() {
  return retryableStart(
    (source: "generic" | "games" | undefined, signal) => read(api.GET("/api/puzzles/next", { params: { query: { source } }, signal })),
    (body, signal) => read(api.POST("/api/puzzle-sessions", { body, signal })),
  );
}
