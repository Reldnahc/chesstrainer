import { useEffect, useRef, useState } from "react";
import { api, read, type Schema } from "./api";
import { useQuery } from "./useQuery";

export type GameProvider = Schema["GameProvider"];

// The registered providers are fixed for the server's lifetime, so one request
// serves every screen that lists them; a failure is asked again next time.
let providers: Promise<GameProvider[]> | null = null;
export function loadGameProviders(signal?: AbortSignal): Promise<GameProvider[]> {
  providers ??= read(api.GET("/api/game-providers")).catch(error => {
    providers = null;
    throw error;
  });
  if (!signal) return providers;
  return new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    providers!.then(resolve, reject);
  });
}

/** The registered game providers (Chess.com, Lichess…), loaded once per page load. */
export function useGameProviders() {
  return useQuery(loadGameProviders);
}

/**
 * A text field that follows the server's value until the reader edits it, so a
 * poll never overwrites an unfinished edit. `settle` hands it back to the server
 * once the edit is saved.
 */
export function useServerDraft(server: string | undefined) {
  const [draft, setDraft] = useState(server ?? "");
  const edited = useRef(false);
  useEffect(() => {
    if (server !== undefined && !edited.current) setDraft(server);
  }, [server]);
  return {
    draft,
    edit: (value: string) => {
      edited.current = true;
      setDraft(value);
    },
    settle: (value: string) => {
      edited.current = false;
      setDraft(value);
    },
  };
}
