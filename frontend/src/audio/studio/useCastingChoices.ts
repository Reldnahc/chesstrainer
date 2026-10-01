import { useCallback, useEffect, useRef, useState } from "react";

export type CastingRecording = {id: string; fingerprint: string; audioSha256: string; generatedVoiceId: string};
export type CastingLock = {
  coachId: string; directionId: string; label: string; recording: CastingRecording;
  savedVoiceId: string; voiceName: string; lockedAt: string; stale: boolean; staleReason?: string;
};
export type CastingChoice = {
  coachId: string;
  status: "selected" | "keep-looking";
  note: string;
  updatedAt: string;
  revision: string;
  stale: boolean;
  staleReason?: string;
  directionId?: string;
  recording?: CastingRecording;
};
export type CastingDecision = {status: "selected"; directionId: string; note?: string} |
  {status: "keep-looking"; note?: string};

const endpoint = "/__fieldwork/casting";
const unavailable = "Saved choices are unavailable. Run or restart the local studio, then retry.";
const errorMessage = (error: unknown) => error instanceof TypeError || !(error instanceof Error) ? unavailable : error.message;
async function responseBody(response: Response) {
  let body;
  try { body = await response.json(); } catch { throw new Error(unavailable); }
  if (!response.ok) throw new Error(body.error?.message ?? "The studio could not save this choice.");
  if (body.schemaVersion !== 1) throw new Error("The studio returned an unsupported choice format. Reload and try again.");
  return body;
}

/** Studio-host decisions, shared by both developer surfaces and all LAN devices. */
export function useCastingChoices() {
  const [choices, setChoices] = useState<Record<string, CastingChoice>>({});
  const [locks, setLocks] = useState<Record<string, CastingLock>>({});
  const [candidates, setCandidates] = useState<Record<string, Record<string, CastingRecording>>>({});
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState<{coachId: string; message: string}>();
  const [savingCoach, setSavingCoach] = useState<string>();
  const mounted = useRef(false);
  const loadController = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const writing = useRef(false);

  const reload = useCallback(async () => {
    if (writing.current) return;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    const current = ++generation.current;
    setReady(false);
    setLoadError("");
    setSaveError(undefined);
    try {
      const response = await fetch(endpoint, {signal: controller.signal, cache: "no-store"});
      const body = await responseBody(response);
      if (!body.choices || typeof body.choices !== "object" || Array.isArray(body.choices) ||
          !body.candidates || typeof body.candidates !== "object" || Array.isArray(body.candidates) ||
          !body.locks || typeof body.locks !== "object" || Array.isArray(body.locks))
        throw new Error("The studio returned an invalid choice list. Reload and try again.");
      if (!mounted.current || current !== generation.current) return;
      setChoices(body.choices);
      setLocks(body.locks);
      setCandidates(body.candidates);
      setReady(true);
    } catch (error) {
      if (!mounted.current || current !== generation.current || controller.signal.aborted) return;
      setLoadError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
      generation.current++;
      loadController.current?.abort();
    };
  }, [reload]);

  async function write(coachId: string, decision: CastingDecision | null) {
    if (!ready || writing.current || locks[coachId]) return false;
    writing.current = true;
    const current = ++generation.current;
    setSavingCoach(coachId);
    setSaveError(undefined);
    try {
      const expectedRevision = choices[coachId]?.revision ?? null;
      const expectedRecordingFingerprint = decision?.status === "selected"
        ? candidates[coachId]?.[decision.directionId]?.fingerprint : undefined;
      if (decision?.status === "selected" && !expectedRecordingFingerprint)
        throw new Error("This recording is no longer available. Refresh choices before trying again.");
      const response = await fetch(`${endpoint}/${encodeURIComponent(coachId)}`, {
        method: decision ? "PUT" : "DELETE",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({...decision, expectedRevision, ...(expectedRecordingFingerprint ? {expectedRecordingFingerprint} : {})}),
      });
      const body = await responseBody(response);
      if (decision ? body.choice?.coachId !== coachId : body.coachId !== coachId || body.choice !== null)
        throw new Error("The studio returned a different coach’s choice. Refresh before trying again.");
      if (!mounted.current || current !== generation.current) return false;
      setChoices(previous => {
        const next = {...previous};
        if (decision) next[coachId] = body.choice;
        else delete next[coachId];
        return next;
      });
      return true;
    } catch (error) {
      if (mounted.current && current === generation.current)
        setSaveError({coachId, message: errorMessage(error)});
      return false;
    } finally {
      writing.current = false;
      if (mounted.current && current === generation.current) setSavingCoach(undefined);
    }
  }

  return {choices, locks, candidates, ready, loadError, saveError, savingCoach, reload, write};
}
export type CastingChoices = ReturnType<typeof useCastingChoices>;
