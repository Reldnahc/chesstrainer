import { useEffect, useState } from "react";
import { useOptionalCoachPreferences } from "../../coach/CoachProvider";
import { coachRecording } from "./voiceBank";
import { withSquares, type Squares } from "./pieceVariants";
import { SEQUENCE_SEPARATOR, resolveSentences } from "./sequence";

/** The words a coach says for a meaning: its recorded line when the bank has
 * one, otherwise the line its script would speak. The bubble shows this text,
 * whether or not voice is enabled; playback still requires a recording. */

type ScriptRecord = { id: string; text: string };

// Only each script's coach ID and file URL are bundled up front; the records are
// fetched per coach on first use, so the 29 scripts never enter the initial
// application download. A plain fetch (rather than a module import, whose
// failure the browser caches) lets a failed load be retried.
const scriptCoaches = import.meta.glob<string>("./banks/*/scripts.json", {
  import: "coachId",
  eager: true,
  query: "?coach",
});
const scriptUrls = import.meta.glob<string>("./banks/*/scripts.json", {
  import: "default",
  eager: true,
  query: "?url",
});
const scriptPaths = new Map(
  Object.entries(scriptCoaches).map(([path, coachId]) => [coachId, path.replace(/\?.*$/, "")]),
);
async function fetchRecords(url: string): Promise<readonly ScriptRecord[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Coach script unavailable (${response.status})`);
  return ((await response.json()) as { records: readonly ScriptRecord[] }).records;
}
const loadedScripts = new Map<string, ReadonlyMap<string, string>>();
const loadingScripts = new Map<string, Promise<void>>();

export function hasCoachScript(coachId: string): boolean {
  return scriptPaths.has(coachId);
}

/** Resolves once this coach's script is cached; a failed load can be retried later. */
export function loadCoachScript(coachId: string): Promise<void> {
  const path = scriptPaths.get(coachId),
    url = path ? scriptUrls[path] : undefined;
  if (!url || loadedScripts.has(coachId)) return Promise.resolve();
  let pending = loadingScripts.get(coachId);
  if (!pending) {
    pending = fetchRecords(url)
      .then(records => {
        loadedScripts.set(coachId, new Map(records.map(record => [record.id, record.text])));
      })
      .finally(() => loadingScripts.delete(coachId));
    loadingScripts.set(coachId, pending);
  }
  return pending;
}

// A recorded alternative wins, since that is what plays; otherwise the first scripted one.
function sentences(coachId: string, id: string): string[] | null {
  return resolveSentences(
    id,
    part => !!coachRecording(coachId, part),
    part => !!loadedScripts.get(coachId)?.has(part),
  );
}

/** The meaning whose words {@link spokenText} shows, with any alternatives resolved. */
export function spokenId(
  coachId: string | null | undefined,
  id: string | null | undefined,
): string | null {
  if (!coachId || !id) return null;
  return sentences(coachId, id)?.join(SEQUENCE_SEPARATOR) ?? id;
}

/** Synchronous lookup; a script that has not loaded yet reads as unknown (null).
 * A sequence is one line only when every sentence resolves. Squares are written
 * after the pieces a line names, keyed by the concrete sentence, for the bubble only. */
export function spokenText(
  coachId: string | null | undefined,
  id: string | null | undefined,
  squares?: Squares,
): string | null {
  if (!coachId || !id) return null;
  const parts = sentences(coachId, id);
  return (
    parts
      ?.map(part =>
        withSquares(
          part,
          coachRecording(coachId, part)?.text ?? loadedScripts.get(coachId)!.get(part)!,
          squares,
        ),
      )
      .join(" ") ?? null
  );
}

/** Null while the coach's script loads or when it has no line for this meaning;
 * callers then show their written text. A failed load is retried when the
 * meaning or coach changes, so one network failure does not last until remount. */
export function useSpokenText(
  coachId: string | null | undefined,
  id: string | null | undefined,
  squares?: Squares,
): string | null {
  const [, setLoaded] = useState(0);
  const text = spokenText(coachId, id, squares);
  const waiting =
    !!coachId && !!id && text === null && hasCoachScript(coachId) && !loadedScripts.has(coachId);
  useEffect(() => {
    if (!waiting || !coachId) return;
    let live = true;
    loadCoachScript(coachId).then(
      () => {
        if (live) setLoaded(count => count + 1);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [waiting, coachId, id]);
  return text;
}

/** The selected coach's line, once saved coach preferences have loaded. */
export function useSelectedCoachSpokenText(id: string | null | undefined): string | null {
  const coach = useOptionalCoachPreferences();
  return useSpokenText(coach?.ready ? coach.preferences.coach_id : null, id);
}
