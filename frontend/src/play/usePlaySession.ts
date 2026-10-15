import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, errorMessage, read, type Schema } from "../api";
import { navigate as openPage, playGamePath } from "../navigation";
import { useAudioScope, useCurrentSpeechPlayback } from "../audio/AudioProvider";
import usePageShortcuts from "../usePageShortcuts";
import { useDeadline } from "../useDeadline";
import type { Game, Report } from "../gameReview/types";
import { useAnalysisRequests } from "../gameReview/useAnalysisRequests";
import { speechNavigationFor, type SpeechNavigation } from "../gameReview/useGameExploration";

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

// The learner's latest move: when it was played, whether its line has been heard,
// and when the coach panel, holding on it, first had its grade to show.
type Turn = { movedAt: number; voiced: boolean; gradedAt: number | null };

/**
 * A live game against the coach's bot. The server owns the moves; this hook owns
 * which position is shown, when the bot's reply is revealed, and the review
 * reports fetched for each played move so the coach can comment live.
 */
export function usePlaySession(id: string) {
  const audio = useAudioScope(`play:${id}`);
  // Play's only speech is the coach's, so any line playing is the one the panel waits on.
  const voicePlaying = !!useCurrentSpeechPlayback();
  const [state, setState] = useState<PlayState | null>(null);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  // Review reports by ply; a saved frame's report is known without a request.
  const analyses = useAnalysisRequests<Report | null>(id);
  const { request: requestReport, seed, discard } = analyses;
  const [explanationKey, setExplanationKey] = useState<string | null>(null);
  // Automatic speech per position: the reply adds its own without retiring the
  // learner's move's, so a line still waiting for its report is not lost.
  const [speechNavigations, setSpeechNavigations] = useState<Record<string, SpeechNavigation>>({});
  // The learner's ply the coach panel stays on while the board shows the reply.
  const [held, setHeld] = useState<number | null>(null);
  const [turn, setTurn] = useState<Turn>({ movedAt: 0, voiced: false, gradedAt: null });
  // The bot's answer, fetched as soon as the learner's move is saved but shown later.
  const [pending, setPending] = useState<{ reply: Reply; at: number; learnerPly: number } | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyAttempt, setReplyAttempt] = useState(0);
  const mounted = useRef(false);
  const events = useRef(0);
  const commandRunning = useRef(false);
  const replyRequested = useRef<number | null>(null);
  // A reply in flight stops answering the game after a command, a take-back or a rewind.
  const replyGeneration = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const report = (ply: number) => analyses.get(String(ply)) ?? null;
  const graded = (ply: number) => !!report(ply) || !!analyses.failure(String(ply));

  const accept = useCallback((next: PlayState) => {
    setState(next);
    seed(next.frames.flatMap((frame, ply) => (frame.report ? [[String(ply), frame.report as Report] as const] : [])));
  }, [seed]);

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
        if (active && mounted.current) setError(errorMessage(e));
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
      const navigation = speechNavigationFor(id, `${ply}:`, eventId, true);
      setSpeechNavigations((current) =>
        interrupt ? { [navigation.key]: navigation } : { ...current, [navigation.key]: navigation },
      );
    },
    [audio, id],
  );

  const requestAnalysis = useCallback(
    (ply: number) => {
      if (ply < 1) return;
      void requestReport(String(ply), async () => {
        const result = await read(
          api.POST("/api/play/{play_id}/analyze", { params: { path: { play_id: id } }, body: { ply } }),
        );
        return (result.report as Report | null) ?? null;
      });
    },
    [requestReport, id],
  );

  // Commentary is always live: every move is graded as it lands, in order. Known
  // and in-flight reports are not asked for again.
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
    const started = replyGeneration.current;
    read(api.POST("/api/play/{play_id}/reply", { params: { path: { play_id: id } } }))
      .then((next) => {
        if (!mounted.current || started !== replyGeneration.current) return;
        accept(next);
        if (next.reply && next.reply.ply > learnerPly) {
          setPending({ reply: next.reply, at: Date.now(), learnerPly });
        }
        else setShown(next.frames.length - 1);
        setReplyError(null);
      })
      .catch((e) => {
        if (started !== replyGeneration.current) return;
        // Asking again is safe: a repeated request returns the move already chosen.
        replyRequested.current = null;
        if (mounted.current) setReplyError(errorMessage(e));
      });
  }, [state, botToMove, shown, id, accept, replyAttempt]);

  // Reveal the reply once the learner's move is graded. A book reply needs no grade.
  const reportOverdue = useDeadline(pending ? pending.at + REPORT_TIMEOUT_MS : null);
  const revealReady = !!pending && (pending.learnerPly === 0 || pending.reply.source === "book"
    || !!report(pending.learnerPly) || !!analyses.failure(String(pending.learnerPly)) || reportOverdue);
  useEffect(() => {
    if (!pending || !revealReady) return;
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
  }, [pending, revealReady, announce]);

  // The coach panel follows the board once the learner's line has been said: when
  // its voice ends, or, with no voice, a while after the grade is on screen.
  const heldGraded = held !== null && graded(held);
  useEffect(() => {
    if (voicePlaying) setTurn((current) => (current.voiced ? current : { ...current, voiced: true }));
  }, [voicePlaying]);
  useEffect(() => {
    if (heldGraded) setTurn((current) => (current.gradedAt === null ? { ...current, gradedAt: Date.now() } : current));
  }, [heldGraded]);
  const holdShown = useDeadline(held !== null && !turn.voiced && turn.gradedAt !== null ? turn.gradedAt + COACH_HOLD_MS : null);
  const holdOverdue = useDeadline(held !== null ? turn.movedAt + REPORT_TIMEOUT_MS : null);
  const said = turn.voiced ? !voicePlaying : holdShown;
  useEffect(() => {
    if (held !== null && (said || holdOverdue)) setHeld(null);
  }, [held, said, holdOverdue]);

  // Drop everything known about the moves after this ply: they are no longer played.
  function forget(kept: number) {
    replyGeneration.current += 1;
    replyRequested.current = null;
    discard((key) => Number(key) <= kept);
    audio.cancel();
    setPending(null);
    setHeld(null);
    setSpeechNavigations({});
    setReplyError(null);
    setExplanationKey(null);
  }

  // A move on the latest position plays on; on an earlier one it rewinds the game
  // there, and the new move replaces everything after it.
  async function play(from: string, to: string, promotion?: string) {
    if (!state || moving || busy || state.status !== "active") return;
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
      setTurn({ movedAt: Date.now(), voiced: false, gradedAt: null });
      setHeld(null);
      accept(next);
      setExplanationKey(null);
      setShown(at + 1);
      setCursor(null);
      announce(at + 1, next.frames[at + 1]?.san);
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      if (mounted.current) setMoving(false);
    }
  }

  // One command at a time. A reply still in flight answered the game as it was
  // before the command, so it is retired; the game asks again if it still needs one.
  async function command(send: () => Promise<PlayState>, apply: (next: PlayState) => void) {
    if (commandRunning.current) return;
    commandRunning.current = true;
    setBusy(true);
    setError("");
    replyGeneration.current += 1;
    replyRequested.current = null;
    try {
      const next = await send();
      if (!mounted.current) return;
      // The command answered the game, so a failed reply to the earlier position is settled.
      setReplyError(null);
      apply(next);
    } catch (e) {
      if (!mounted.current) return;
      setError(errorMessage(e));
      // The reply is asked for again now, so its old failure (and Try again) goes.
      setReplyError(null);
      setReplyAttempt((value) => value + 1);
    } finally {
      commandRunning.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const path = { params: { path: { play_id: id } } };

  // Opening practice: answer the off-book prompt.
  const takeBack = () => {
    if (!state || !deviation) return;
    void command(() => read(api.POST("/api/play/{play_id}/takeback", path)), (next) => {
      const kept = next.frames.length - 1;
      forget(kept);
      accept(next);
      setShown(kept);
      setCursor(null);
    });
  };
  // The usual bot answers the move the learner kept.
  const carryOn = () => {
    if (!state || !deviation) return;
    void command(() => read(api.POST("/api/play/{play_id}/carry-on", path)), accept);
  };
  const keepPlaying = () => {
    if (!state || !lineOver) return;
    void command(() => read(api.POST("/api/play/{play_id}/keep-playing", path)), accept);
  };
  // A fresh practice game with the same course, coach and strength.
  const goAgain = () => {
    const practice = state?.practice;
    if (!state || !practice) return;
    void command(() => read(api.POST("/api/play", {
      body: {
        coach_id: state.coach_id as Schema["PlayRequest"]["coach_id"],
        coach_name: state.coach_name,
        color: state.learner_color,
        opponent: state.opponent,
        rating: state.rating,
        course_id: practice.course_id,
      },
    })), (next) => openPage(playGamePath(next.id)));
  };
  const resign = () => {
    if (!state || state.status !== "active") return;
    void command(() => read(api.POST("/api/play/{play_id}/resign", path)), (next) => {
      setPending(null);
      accept(next);
      setShown(next.frames.length - 1);
    });
  };

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
        audio.step(ply, next, state.frames[next]?.san, `${eventId}:board`);
        const navigation = speechNavigationFor(id, `${next}:`, eventId, false);
        setSpeechNavigations({ [navigation.key]: navigation });
      }
    },
    [state, latest, ply, audio, id],
  );

  // Scrubbing the graph moves silently; letting go on another move speaks it once, as review does.
  const scrubOrigin = useRef<number | null>(null);
  const beginScrubbing = () => {
    audio.cancel();
    scrubOrigin.current = ply;
  };
  const finishScrubbing = (target: number) => {
    const origin = scrubOrigin.current;
    scrubOrigin.current = null;
    if (origin === null || origin === target) return;
    const eventId = ++events.current;
    audio.play("move", `${eventId}:board`);
    const navigation = speechNavigationFor(id, `${target}:`, eventId, false);
    setSpeechNavigations({ [navigation.key]: navigation });
  };

  // MovePlaybackControls binds the arrow keys; the page owns Escape.
  usePageShortcuts({ Escape: () => setExplanationKey(null) });

  // The review's own components read a Game; a live game is one with no saved review.
  const { get: reportAt, revision } = analyses;
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
      frames: state.frames.slice(0, latest + 1).map((frame, index) => ({ ...frame, report: reportAt(String(index)) ?? null })),
      job: null,
      accuracy: null,
      context: null,
      history: null,
      review_revision: 0,
    };
    // reportAt reads the cache; revision changes whenever a report is added or dropped.
  }, [state, latest, reportAt, revision]);

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
  const coachFailure = coachPly > 0 ? analyses.failure(String(coachPly)) : null;
  return {
    state,
    game,
    error,
    /** The bot's reply failed; asking again (retryReply) is safe and the only way on, so it is not dismissed. */
    replyError: botToMove ? replyError : null,
    dismissError: () => setError(""),
    moving,
    /** A command (take back, play on, keep playing, go again, resign) is being sent. */
    busy,
    ply,
    latest,
    browsing,
    canRewind,
    waitingForBot,
    learnerToMove,
    frame: game?.frames[ply] ?? null,
    report: report(ply),
    coach: {
      ply: coachPly,
      frame: game?.frames[coachPly] ?? null,
      report: report(coachPly),
      speechNavigation: speechNavigations[`${coachPly}:`] ?? null,
    },
    /** The coach's position failed to analyse; Retry asks for that position again. */
    analysisError: coachFailure,
    explaining: explanationKey === `${ply}:`,
    toggleExplanation: () => setExplanationKey((value) => (value === `${ply}:` ? null : `${ply}:`)),
    navigate,
    beginScrubbing,
    finishScrubbing,
    play,
    resign,
    practice: state?.practice ?? null,
    deviation,
    lineOver,
    keepPlaying,
    goAgain,
    takeBack,
    carryOn,
    retryAnalysis: () => {
      analyses.clearFailure(String(coachPly));
      requestAnalysis(coachPly);
    },
    retryReply: () => {
      replyRequested.current = null;
      setReplyError(null);
      setReplyAttempt((value) => value + 1);
    },
  };
}

export type PlaySession = ReturnType<typeof usePlaySession>;
