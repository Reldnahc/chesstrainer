import { useState } from "react";
import { navigate } from "./navigation";
import { useCommand } from "./useQuery";

/**
 * Starts a session and opens it: the one way a screen creates a lesson, puzzle,
 * practice or Play session. `create` builds the starter once (a retryableStart
 * keeps its request id until the server acknowledges it, so Try again never
 * makes a second session); `toPath` is where a created session opens. A starter
 * that finds nothing to start returns null, and `start`'s `none` runs instead.
 * Busy and error state are a useCommand's, so CommandError shows a failure.
 */
export function useSessionStart<Target, Session>(
  create: () => (target: Target, signal?: AbortSignal) => Promise<Session | null>,
  toPath: (session: Session) => string,
) {
  const [starter] = useState(create);
  // The key names what is starting (a chapter, a puzzle mode), so only its control shows it.
  const command = useCommand<string>();
  function start(key: string, target: Target, none?: () => void) {
    return command.run(key, (signal) => starter(target, signal), (session) => {
      if (session) navigate(toPath(session));
      else none?.();
    });
  }
  return { busy: command.busy, error: command.error, setError: command.setError, dismiss: command.dismiss, start };
}
