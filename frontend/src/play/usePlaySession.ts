import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, read, type Schema } from "../api";
import { useAudioScope } from "../audio/AudioProvider";
import type { Analysis, Game, Report } from "../gameReview/types";
import type { SpeechNavigation } from "../gameReview/useGameExploration";

export type PlayState = Schema["PlayState"];
type Reply = NonNullable<PlayState["reply"]>;

// The coach comments on the learner's move before answering it: the reply waits
// for that move's report, for the coach's voice line to finish, then a short pause.
const REPLY_PAUSE_MS = 2500;
const VOICE_START_GRACE_MS = 1500;
const REPORT_TIMEOUT_MS = 20000;

/**
 * A live game against the coach's bot. The server owns the moves; this hook owns
 * which position is shown, when the bot's reply is revealed, and the review
 * reports fetched for each played move so the coach can comment live.
 */
export function usePlaySession(id: string) {
  const audio = useAudioScope(`play:${id}`);
  const [state, setState] = useState<PlayState | null>(null);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState(false);
  const [shown, setShown] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const [reports, setReports] = useState<Record<number, Report>>({});
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [explanationKey, setExplanationKey] = useState<string | null>(null);
  const [speechNavigation, setSpeechNavigation] = useState<SpeechNavigation | null>(null);
  // The bot's answer, fetched as soon as the learner's move is saved but shown later.
  const [pending, setPending] = useState<{ reply: Reply; at: number; learnerPly: number } | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const voiceSeen = useRef(false);
  const reportAt = useRef<number | null>(null);
  const [tick, setTick] = useState(0);
  const mounted = useRef(false);
  const events = useRef(0);
  const analysisQueue = useRef<Promise<unknown>>(Promise.resolve());
  const requested = useRef(new Set<number>());
  const replyRequested = useRef<number | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const accept = useCallback((next: PlayState) => {
    setState(next);
    setReports((saved) => {
      const merged = { ...saved };
      next.frames.forEach((frame, ply) => {
        if (frame.report) merged[ply] = frame.report as Report;
      });
      return merged;
    });
  }, []);

  useEffect(() => {
    let active = true;
    read(api.GET("/api/play/{play_id}", { params: { path: { play_id: id } } }))
      .then((value) => {
        if (!active || !mounted.current) return;
        accept(value);
        setShown(value.frames.length - 1);
        setCursor(null);
      })
      .catch((e) => {
        if (active && mounted.current) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, accept]);

  const announce = useCallback(
    (ply: number, san: string | null | undefined) => {
      const eventId = ++events.current;
      audio.cancel();
      audio.move(san, `${eventId}:board`);
      setSpeechNavigation({ key: `${ply}:`, eventId: `${id}:${eventId}`, awaitAnalysis: true });
    },
    [audio, id],
  );

  const requestAnalysis = useCallback(
    (ply: number) => {
      if (ply < 1 || requested.current.has(ply)) return analysisQueue.current;
      requested.current.add(ply);
      const run = async () => {
        try {
          const result: Analysis = await read(
            api.POST("/api/play/{play_id}/analyze", {
              params: { path: { play_id: id } },
              body: { ply },
            }),
          );
          if (!mounted.current) return;
          if (result.report) setReports((saved) => ({ ...saved, [ply]: result.report as Report }));
          setAnalysisError(null);
        } catch (e) {
          requested.current.delete(ply);
          if (mounted.current) setAnalysisError((e as Error).message);
        }
      };
      analysisQueue.current = analysisQueue.current.then(run, run);
      return analysisQueue.current;
    },
    [id],
  );

  // Commentary is always live: every move is graded as it lands, in order.
  useEffect(() => {
    if (!state) return;
    for (let ply = 1; ply <= shown; ply++) requestAnalysis(ply);
  }, [state, shown, requestAnalysis]);

  // Ask for the bot's answer whenever the shown position leaves it to move.
  const learnerColor = state?.learner_color;
  const botToMove =
    !!state && state.status === "active" && shown === state.frames.length - 1 && state.frames[shown]?.turn !== learnerColor;
  useEffect(() => {
    if (!state || !botToMove || replyRequested.current === shown) return;
    replyRequested.current = shown;
    const learnerPly = shown;
    read(api.POST("/api/play/{play_id}/reply", { params: { path: { play_id: id } } }))
      .then((next) => {
        if (!mounted.current) return;
        setState((current) => (current ? { ...next, frames: next.frames } : next));
        setReports((saved) => {
          const merged = { ...saved };
          next.frames.forEach((frame, ply) => {
            if (frame.report) merged[ply] = frame.report as Report;
          });
          return merged;
        });
        if (next.reply && next.reply.ply > learnerPly) setPending({ reply: next.reply, at: Date.now(), learnerPly });
        else setShown(next.frames.length - 1);
        setReplyError(null);
      })
      .catch((e) => {
        replyRequested.current = null;
        if (mounted.current) setReplyError((e as Error).message);
      });
  }, [state, botToMove, shown, id]);

  // Reveal the reply once the coach has had its say about the learner's move.
  useEffect(() => {
    if (!pending) return;
    const report = reports[pending.learnerPly];
    const now = Date.now();
    const ready = pending.learnerPly === 0 || !!report || !!analysisError || now - pending.at > REPORT_TIMEOUT_MS;
    if (ready && reportAt.current === null) reportAt.current = now;
    if (!ready) {
      const timer = window.setTimeout(() => setTick((value) => value + 1), 500);
      return () => window.clearTimeout(timer);
    }
    if (voicePlaying) return;
    const sinceReport = now - (reportAt.current ?? now);
    const wait = voiceSeen.current || sinceReport >= VOICE_START_GRACE_MS
      ? REPLY_PAUSE_MS
      : VOICE_START_GRACE_MS - sinceReport + REPLY_PAUSE_MS;
    const timer = window.setTimeout(() => {
      if (!mounted.current) return;
      const { reply } = pending;
      setPending(null);
      reportAt.current = null;
      voiceSeen.current = false;
      setShown(reply.ply);
      setCursor(null);
      announce(reply.ply, reply.san);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [pending, reports, analysisError, voicePlaying, tick, announce]);

  const onVoicePlaying = useCallback((playing: boolean) => {
    if (playing) voiceSeen.current = true;
    setVoicePlaying(playing);
  }, []);

  async function play(from: string, to: string, promotion?: string) {
    if (!state || moving || pending || state.status !== "active") return;
    const ply = state.frames.length - 1;
    const uci = from + to + (promotion || "");
    setMoving(true);
    setError("");
    try {
      const next = await read(
        api.POST("/api/play/{play_id}/move", {
          params: { path: { play_id: id } },
          body: { ply, uci },
        }),
      );
      if (!mounted.current) return;
      voiceSeen.current = false;
      reportAt.current = null;
      accept(next);
      setExplanationKey(null);
      setShown(ply + 1);
      setCursor(null);
      announce(ply + 1, next.frames[ply + 1]?.san);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setMoving(false);
    }
  }

  async function resign() {
    if (!state || state.status !== "active") return;
    setError("");
    try {
      const next = await read(
        api.POST("/api/play/{play_id}/resign", { params: { path: { play_id: id } } }),
      );
      if (!mounted.current) return;
      setPending(null);
      accept(next);
      setShown(next.frames.length - 1);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    }
  }

  // The latest position the learner may see: a fetched reply stays hidden until revealed.
  const latest = state ? Math.min(shown, state.frames.length - 1) : 0;
  const ply = cursor === null ? latest : Math.max(0, Math.min(cursor, latest));
  const navigate = useCallback(
    (target: number, options?: { silent?: boolean }) => {
      if (!state) return;
      const next = Math.max(0, Math.min(latest, target));
      if (next === ply) return;
      setCursor(next === latest ? null : next);
      setExplanationKey(null);
      if (!options?.silent) {
        const eventId = ++events.current;
        audio.cancel();
        if (next === ply + 1) audio.move(state.frames[next]?.san, `${eventId}:board`);
        else audio.play("move", `${eventId}:board`);
        setSpeechNavigation({ key: `${next}:`, eventId: `${id}:${eventId}`, awaitAnalysis: false });
      }
    },
    [state, latest, ply, audio, id],
  );

  const keyboard = useRef(navigate);
  keyboard.current = navigate;
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (document.querySelector(":modal, :popover-open")) return;
      if ((event.target as HTMLElement).closest("input,select,textarea,[contenteditable=true]")) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        keyboard.current(ply + (event.key === "ArrowLeft" ? -1 : 1));
      }
      if (event.key === "Escape") setExplanationKey(null);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [ply]);

  // The review's own components read a Game; a live game is one with no saved review.
  const game: Game | null = useMemo(() => {
    if (!state) return null;
    return {
      id: state.id,
      white: state.white,
      black: state.black,
      played_on: null,
      result: state.result ?? "*",
      orientation: state.learner_color,
      rating: state.learner_rating,
      white_rating: state.white_rating,
      black_rating: state.black_rating,
      frames: state.frames.slice(0, latest + 1).map((frame, index) => ({ ...frame, report: reports[index] ?? null })),
      job: null,
      accuracy: null,
      context: null,
      history: null,
      review_revision: 0,
    };
  }, [state, latest, reports]);

  const waitingForBot = !!state && state.status === "active" && state.frames[latest]?.turn !== state.learner_color;
  const learnerToMove = !!state && state.status === "active" && !waitingForBot && !pending;
  return {
    state,
    game,
    error: error || replyError || "",
    dismissError: () => {
      setError("");
      setReplyError(null);
    },
    moving,
    ply,
    latest,
    browsing: ply !== latest,
    waitingForBot,
    learnerToMove,
    frame: game?.frames[ply] ?? null,
    report: reports[ply] ?? null,
    analysisError,
    explaining: explanationKey === `${ply}:`,
    toggleExplanation: () => setExplanationKey((value) => (value === `${ply}:` ? null : `${ply}:`)),
    speechNavigation: speechNavigation?.key === `${ply}:` ? speechNavigation : null,
    navigate,
    play,
    resign,
    retryAnalysis: () => requestAnalysis(ply),
    retryReply: () => {
      replyRequested.current = null;
      setReplyError(null);
      setTick((value) => value + 1);
    },
    onVoicePlaying,
  };
}

export type PlaySession = ReturnType<typeof usePlaySession>;
