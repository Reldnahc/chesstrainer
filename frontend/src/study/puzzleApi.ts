import { api, read } from "../api";

// HTTP LAN installs may not expose randomUUID. These identify retries, not users.
export const puzzleRequestId = () => globalThis.crypto?.randomUUID?.()
  ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

export async function startNextPuzzle(source?: "generic" | "games", signal?: AbortSignal) {
  const next = await read(api.GET("/api/puzzles/next", { params: { query: { source } }, signal }));
  if (!next) return null;
  return read(api.POST("/api/puzzle-sessions", { body: { ...next, request_id: puzzleRequestId() }, signal }));
}
