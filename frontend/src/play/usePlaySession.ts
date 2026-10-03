import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, read, type Schema } from "../api";
import { useAudioScope } from "../audio/AudioProvider";
import type { Analysis, Game, Report } from "../gameReview/types";
import type { SpeechNavigation } from "../gameReview/useGameExploration";

export type PlayState = Schema["PlayState"];

/**
 * A live game against the coach's bot. The server owns the moves; this hook owns
 * which position is shown, the bot's visible thinking pause, and, in live or
 * on-request commentary, the review reports fetched for each played move.
 */
export function usePlaySession(id: string) {
  const audio = useAudioScope(`play:${id}`);
  const [state, setState] = useState<PlayState | null>(null);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState(false);
  // The bot's reply is known as soon as the learner's move is saved, but it is
  // shown after a short pause so the game reads as a game rather than a lookup.
  const [shown, setShown] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const [reports, setReports] = useState<Record<number, Report>>({});
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [explanationKey, setExplanationKey] = useState<string | null>(null);
  const [speechNavigation, setSpeechNavigation] = useState<SpeechNavigation | null>(null);
  const mounted = useRef(false);
  const events = useRef(0);
  const pendingReply = useRef<number | undefined>(undefined);
  const analysisQueue = useRef<Promise<unknown>>(Promise.resolve());
  const requested = useRef(new Set<number>());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(pendingReply.current);
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
    (ply: number, san: string | null | undefined, awaitAnalysis: boolean) => {
      const eventId = ++events.current;
      audio.cancel();
      audio.move(san, `${eventId}:board`);
      setSpeechNavigation({ key: `${ply}:`, eventId: `${id}:${eventId}`, awaitAnalysis });
    },
    [audio, id],
  );

  const commentary = state?.commentary ?? "live";
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

  // Live commentary grades every move as it lands, in order, like the review's queue.
  useEffect(() => {
    if (!state || commentary !== "live") return;
    for (let ply = 1; ply <= shown; ply++) requestAnalysis(ply);
  }, [state, shown, commentary, requestAnalysis]);

  const revealReply = useCallback(
    (next: PlayState) => {
      const reply = next.reply;
      const learnerPly = next.frames.length - 1 - (reply ? 1 : 0);
      setShown(learnerPly);
      setCursor(null);
      if (!reply) return;
      window.clearTimeout(pendingReply.current);
      pendingReply.current = window.setTimeout(() => {
        if (!mounted.current) return;
        setShown(reply.ply);
        setCursor(null);
        announce(reply.ply, reply.san, commentary === "live");
      }, reply.think_ms);
    },
    [announce, commentary],
  );

  async function play(from: string, to: string, promotion?: string) {
    if (!state || moving || state.status !== "active") return;
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
      accept(next);
      setExplanationKey(null);
      const played = next.frames[ply + 1];
      announce(ply + 1, played?.san, commentary === "live");
      revealReply(next);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setMoving(false);
    }
  }

  async function act(action: "resign" | "draw") {
    if (!state || state.status !== "active") return;
    setError("");
    try {
      const next = await read(
        api.POST(action === "resign" ? "/api/play/{play_id}/resign" : "/api/play/{play_id}/draw", {
          params: { path: { play_id: id } },
        }),
      );
      if (mounted.current) accept(next);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    }
  }

  // The latest position the learner may see: the bot's reply stays hidden while it "thinks".
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
      frames: state.frames.slice(0, latest + 1).map((frame, index) => ({
        ...frame,
        report: commentary === "after" ? null : (reports[index] ?? null),
      })),
      job: null,
      accuracy: null,
      context: null,
      history: null,
      review_revision: 0,
    };
  }, [state, latest, reports, commentary]);

  const waitingForBot = !!state && state.status === "active" && latest < state.frames.length - 1;
  const learnerToMove =
    !!state && state.status === "active" && !waitingForBot && state.frames[latest]?.turn === state.learner_color;
  return {
    state,
    game,
    error,
    dismissError: () => setError(""),
    moving,
    ply,
    latest,
    browsing: ply !== latest,
    waitingForBot,
    learnerToMove,
    frame: game?.frames[ply] ?? null,
    report: commentary === "after" ? null : (reports[ply] ?? null),
    analysisError,
    analysisPending: commentary !== "after" && ply > 0 && !reports[ply] && requested.current.has(ply),
    asked: requested.current.has(ply),
    explaining: explanationKey === `${ply}:`,
    toggleExplanation: () => setExplanationKey((value) => (value === `${ply}:` ? null : `${ply}:`)),
    speechNavigation: speechNavigation?.key === `${ply}:` ? speechNavigation : null,
    navigate,
    play,
    resign: () => act("resign"),
    offerDraw: () => act("draw"),
    ask: () => requestAnalysis(ply),
    retryAnalysis: () => requestAnalysis(ply),
  };
}

export type PlaySession = ReturnType<typeof usePlaySession>;
