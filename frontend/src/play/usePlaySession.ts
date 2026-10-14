import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, read, type Schema } from "../api";
import { navigate as openPage, playGamePath } from "../navigation";
import { useAudioScope } from "../audio/AudioProvider";
import type { Analysis, Game, Report } from "../gameReview/types";
import type { SpeechNavigation } from "../gameReview/useGameExploration";

export type PlayState = Schema["PlayState"];
type Reply = NonNullable<PlayState["reply"]>;

// The bot answers a short pause after the learner's move is graded. It does not
// wait for the coach's voice: the line about the learner's move keeps playing over
// the reply, and only the learner's own next move or navigation cuts it.
const REPLY_PAUSE_MS = 400;
const REPORT_TIMEOUT_MS = 20000;
// While that line plays, the coach panel stays on the learner's move. With no voice
// it keeps the line on screen this long after the grade before following the board.
const COACH_HOLD_MS = 2500;

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
  // Automatic speech per position: the reply adds its own without retiring the
  // learner's move's, so a line still waiting for its report is not lost.
  const [speechNavigations, setSpeechNavigations] = useState<Record<string, SpeechNavigation>>({});
  // The learner's ply the coach panel stays on while the board shows the reply.
  const [held, setHeld] = useState<number | null>(null);
  // The bot's answer, fetched as soon as the learner's move is saved but shown later.
  const [pending, setPending] = useState<{ reply: Reply; at: number; learnerPly: number } | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [voicePlaying, setVoicePlaying] = useState(false);
  // Whether the learner's move's line has started, and when its grade arrived.
  const voiceSeen = useRef(false);
  const reportAt = useRef<number | null>(null);
  const heldAt = useRef(0);
  const [tick, setTick] = useState(0);
  const mounted = useRef(false);
  const events = useRef(0);
  const analysisQueue = useRef<Promise<unknown>>(Promise.resolve());
  const requested = useRef(new Set<number>());
  const replyRequested = useRef<number | null>(null);
  // A take-back or rewind retires analysis and replies in flight for the moves it removed.
  const epoch = useRef(0);

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

  // A learner's move or navigation interrupts; the bot's reply only adds its own.
  const announce = useCallback(
    (ply: number, san: string | null | undefined, options?: { interrupt?: boolean }) => {
      const eventId = ++events.current;
      const interrupt = options?.interrupt ?? true;
      if (interrupt) audio.cancel();
      audio.move(san, `${eventId}:board`);
      const navigation = { key: `${ply}:`, eventId: `${id}:${eventId}`, awaitAnalysis: true };
      setSpeechNavigations((current) =>
        interrupt ? { [navigation.key]: navigation } : { ...current, [navigation.key]: navigation },
      );
    },
    [audio, id],
  );

  const requestAnalysis = useCallback(
    (ply: number) => {
      if (ply < 1 || requested.current.has(ply)) return analysisQueue.current;
      requested.current.add(ply);
      const started = epoch.current;
      const run = async () => {
        if (started !== epoch.current) return;
        try {
          const result: Analysis = await read(
            api.POST("/api/play/{play_id}/analyze", {
              params: { path: { play_id: id } },
              body: { ply },
            }),
          );
          if (!mounted.current || started !== epoch.current) return;
          if (result.report) setReports((saved) => ({ ...saved, [ply]: result.report as Report }));
          setAnalysisError(null);
        } catch (e) {
          if (started !== epoch.current) return;
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
  // Off book in opening practice the bot waits for the learner to go back or carry on;
  // the reply request then only reports how the move compares with the book.
  const deviation = state?.practice?.status === "deviation" ? state.practice.deviation : null;
  // At the end of the line the bot also waits: keep playing, or go again.
  const lineOver = state?.status === "active" && state.practice?.status === "book_end";
  const choosing = !!deviation || lineOver;
  const botToMove =
    !!state && state.status === "active" && shown === state.frames.length - 1 && state.frames[shown]?.turn !== learnerColor;
  useEffect(() => {
    if (!state || !botToMove || replyRequested.current === shown) return;
    replyRequested.current = shown;
    const learnerPly = shown;
    const started = epoch.current;
    read(api.POST("/api/play/{play_id}/reply", { params: { path: { play_id: id } } }))
      .then((next) => {
        if (!mounted.current || started !== epoch.current) return;
        setState((current) => (current ? { ...next, frames: next.frames } : next));
        setReports((saved) => {
          const merged = { ...saved };
          next.frames.forEach((frame, ply) => {
            if (frame.report) merged[ply] = frame.report as Report;
          });
          return merged;
        });
        if (next.reply && next.reply.ply > learnerPly) {
          setPending({ reply: next.reply, at: Date.now(), learnerPly });
        }
        else setShown(next.frames.length - 1);
        setReplyError(null);
      })
      .catch((e) => {
        if (started !== epoch.current) return;
        replyRequested.current = null;
        if (mounted.current) setReplyError((e as Error).message);
      });
  }, [state, botToMove, shown, id]);

  // Reveal the reply once the learner's move is graded. A book reply needs no grade.
  useEffect(() => {
    if (!pending) return;
    const now = Date.now();
    const ready = pending.learnerPly === 0 || pending.reply.source === "book" || !!reports[pending.learnerPly]
      || !!analysisError || now - pending.at > REPORT_TIMEOUT_MS;
    if (!ready) {
      const timer = window.setTimeout(() => setTick((value) => value + 1), 500);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      if (!mounted.current) return;
      const { reply, learnerPly } = pending;
      setPending(null);
      setShown(reply.ply);
      setCursor(null);
      if (learnerPly > 0) setHeld(learnerPly);
      announce(reply.ply, reply.san, { interrupt: false });
    }, REPLY_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [pending, reports, analysisError, tick, announce]);

  // The coach panel follows the board once the learner's line has been said.
  useEffect(() => {
    if (held === null) return;
    const now = Date.now();
    const graded = !!reports[held] || !!analysisError;
    if (graded && reportAt.current === null) reportAt.current = now;
    const said = voiceSeen.current
      ? !voicePlaying
      : graded && now - (reportAt.current ?? now) >= COACH_HOLD_MS;
    if (said || now - heldAt.current > REPORT_TIMEOUT_MS) {
      setHeld(null);
      return;
    }
    if (voicePlaying) return;
    const timer = window.setTimeout(() => setTick((value) => value + 1), 250);
    return () => window.clearTimeout(timer);
  }, [held, reports, analysisError, voicePlaying, tick]);

  const onVoicePlaying = useCallback((playing: boolean) => {
    if (playing) voiceSeen.current = true;
    setVoicePlaying(playing);
  }, []);

  // A move on the latest position plays on; on an earlier one it rewinds the game
  // there, and the new move replaces everything after it.
  async function play(from: string, to: string, promotion?: string) {
    if (!state || moving || state.status !== "active") return;
    const rewind = canRewind;
    if (!rewind && (pending || !learnerToMove || browsing)) return;
    const at = rewind ? ply : state.frames.length - 1;
    const uci = from + to + (promotion || "");
    setMoving(true);
    setError("");
    try {
      const next = await read(
        api.POST("/api/play/{play_id}/move", {
          params: { path: { play_id: id } },
          body: { ply: at, uci, rewind },
        }),
      );
      if (!mounted.current) return;
      if (rewind) forget(at);
      voiceSeen.current = false;
      reportAt.current = null;
      heldAt.current = Date.now();
      setHeld(null);
      accept(next);
      setExplanationKey(null);
      setShown(at + 1);
      setCursor(null);
      announce(at + 1, next.frames[at + 1]?.san);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setMoving(false);
    }
  }

  // Drop everything known about the moves after this ply: they are no longer played.
  function forget(kept: number) {
    epoch.current += 1;
    for (const ply of [...requested.current]) if (ply > kept) requested.current.delete(ply);
    replyRequested.current = null;
    audio.cancel();
    setPending(null);
    setHeld(null);
    setSpeechNavigations({});
    setReports((saved) => Object.fromEntries(Object.entries(saved).filter(([ply]) => Number(ply) <= kept)));
    setAnalysisError(null);
    setReplyError(null);
    setExplanationKey(null);
  }

  // Opening practice: answer the off-book prompt.
  async function takeBack() {
    if (!state || !deviation) return;
    setError("");
    try {
      const next = await read(
        api.POST("/api/play/{play_id}/takeback", { params: { path: { play_id: id } } }),
      );
      if (!mounted.current) return;
      const kept = next.frames.length - 1;
      forget(kept);
      accept(next);
      setShown(kept);
      setCursor(null);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    }
  }

  async function carryOn() {
    if (!state || !deviation) return;
    setError("");
    try {
      const next = await read(
        api.POST("/api/play/{play_id}/carry-on", { params: { path: { play_id: id } } }),
      );
      if (!mounted.current) return;
      // The usual bot answers the move the learner kept.
      replyRequested.current = null;
      accept(next);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    }
  }

  async function keepPlaying() {
    if (!state || !lineOver) return;
    setError("");
    try {
      const next = await read(
        api.POST("/api/play/{play_id}/keep-playing", { params: { path: { play_id: id } } }),
      );
      if (!mounted.current) return;
      replyRequested.current = null;
      accept(next);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    }
  }

  // A fresh practice game with the same course, coach and strength.
  async function goAgain() {
    if (!state?.practice) return;
    setError("");
    try {
      const next = await read(
        api.POST("/api/play", {
          body: {
            coach_id: state.coach_id as Schema["PlayRequest"]["coach_id"],
            coach_name: state.coach_name,
            color: state.learner_color,
            opponent: state.opponent,
            rating: state.rating,
            course_id: state.practice.course_id,
          },
        }),
      );
      openPage(playGamePath(next.id));
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
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
      setHeld(null);
      if (!options?.silent) {
        const eventId = ++events.current;
        audio.cancel();
        if (next === ply + 1) audio.move(state.frames[next]?.san, `${eventId}:board`);
        else audio.play("move", `${eventId}:board`);
        const navigation = { key: `${next}:`, eventId: `${id}:${eventId}`, awaitAnalysis: false };
        setSpeechNavigations({ [navigation.key]: navigation });
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
      read_only: false,
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

  const waitingForBot =
    !!state && state.status === "active" && !choosing && state.frames[latest]?.turn !== state.learner_color;
  const learnerToMove =
    !!state && state.status === "active" && !choosing && !waitingForBot && !pending;
  const browsing = ply !== latest;
  // Looking back at a position where it was the learner's move, they may play from there.
  const canRewind =
    !!state && state.status === "active" && browsing && state.frames[ply]?.turn === state.learner_color;
  // The coach panel's position: the board's, or the learner's move while its line plays.
  const coachPly = held !== null && cursor === null && held < latest ? held : ply;
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
    browsing,
    canRewind,
    waitingForBot,
    learnerToMove,
    frame: game?.frames[ply] ?? null,
    report: reports[ply] ?? null,
    coach: {
      ply: coachPly,
      frame: game?.frames[coachPly] ?? null,
      report: reports[coachPly] ?? null,
      speechNavigation: speechNavigations[`${coachPly}:`] ?? null,
    },
    analysisError,
    explaining: explanationKey === `${ply}:`,
    toggleExplanation: () => setExplanationKey((value) => (value === `${ply}:` ? null : `${ply}:`)),
    navigate,
    play,
    resign,
    practice: state?.practice ?? null,
    deviation,
    lineOver,
    keepPlaying,
    goAgain,
    takeBack,
    carryOn,
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
