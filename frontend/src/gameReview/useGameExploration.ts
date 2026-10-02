import { useEffect, useRef, useState } from "react";
import { api, read } from "../api";
import { rememberGamePly } from "../navigation";
import { useAudioScope } from "../audio/AudioProvider";
import type { Branch, Cursor, Game, Position } from "./types";

export type SpeechNavigation = {
  key: string;
  eventId: string;
  awaitAnalysis: boolean;
  /** The review was just opened at its untouched start, not navigated to. */
  opening?: boolean;
};

/** Owns variation history and navigation without mutating the original game. */
export function useGameExploration(
  id: string,
  initialPly: number,
  game: Game | null,
  fail: (message: string) => void,
) {
  const audio = useAudioScope(`game:${id}`);
  const [selection, setCursor] = useState<Cursor>({
    ply: initialPly,
    branch: null,
    step: 0,
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [moving, setMoving] = useState(false);
  const [branchPosition, setBranchPosition] = useState<{
    key: string;
    value: Position;
  } | null>(null);
  const [explanationKey, setExplanationKey] = useState<string | null>(null);
  const [speechNavigation, setSpeechNavigation] = useState<SpeechNavigation | null>(null);
  const nextId = useRef(1);
  const mounted = useRef(false);
  const activeKey = useRef("");
  // User actions, rather than position identity, distinguish returning to a
  // position from accepting a response that belongs to an earlier visit.
  const actionVersion = useRef(0);
  const pendingNavigation = useRef<{ key: string; eventId: number; forward: boolean } | null>(null);
  const scrubOrigin = useRef<string | null>(null);
  // Clamp before rendering: a bookmarked ply can exceed the loaded game's length.
  const cursor = game
    ? { ...selection, ply: Math.min(selection.ply, game.frames.length - 1) }
    : selection;
  const branch = branches.find((b) => b.id === cursor.branch);
  const path = branch ? branch.moves.slice(0, cursor.step) : [];
  const root = branch ? branch.root : cursor.ply;
  const key = `${root}:${path.join(",")}`;
  activeKey.current = key;
  const frame = branch
    ? branchPosition?.key === key
      ? branchPosition.value
      : null
    : game?.frames[cursor.ply];
  const current = branch ? cursor.step : cursor.ply;
  const maximum = branch ? branch.moves.length : (game?.frames.length ?? 1) - 1;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (game) setOrientation(game.orientation);
  }, [game?.id]);
  // Opening an untouched review at the start is one fresh greeting event. A
  // restored later ply or a branch stays silent; any navigation replaces it.
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!game || opened.current === game.id) return;
    opened.current = game.id;
    if (selection.ply === 0 && selection.branch === null && actionVersion.current === 0)
      setSpeechNavigation({key: "0:", eventId: `${id}:open`, awaitAnalysis: false, opening: true});
  }, [game?.id]);
  useEffect(() => {
    if (game && !branch) rememberGamePly(id, cursor.ply);
  }, [id, !!game, cursor.ply, !!branch]);

  useEffect(() => {
    if (!branch) return;
    // play() and selectBranch() store the position they already hold; only
    // positions this hook has not seen need a request.
    if (branchPosition?.key === key) return;
    let active = true;
    const requestAction = actionVersion.current;
    read(
      api.POST("/api/games/{game_id}/position", {
        params: { path: { game_id: id } },
        body: {
          ply: root,
          moves: path,
        },
      }),
    )
      .then((value) => {
        if (!active || !mounted.current || activeKey.current !== key) return;
        setBranchPosition({ key, value });
        const pending = pendingNavigation.current;
        if (pending?.key === key && pending.eventId === requestAction && pending.eventId === actionVersion.current) {
          pendingNavigation.current = null;
          if (pending.forward) audio.move(value.san, `${pending.eventId}:board`);
          else audio.play("move", `${pending.eventId}:board`);
        }
      })
      .catch((e) => {
        if (!active || !mounted.current || activeKey.current !== key) return;
        if (pendingNavigation.current?.eventId === requestAction) pendingNavigation.current = null;
        setSpeechNavigation(value => value?.eventId === `${id}:${requestAction}` ? null : value);
        fail(e.message);
      });
    return () => {
      active = false;
    };
    // The key includes the entire variation, including repetition history.
  }, [id, key, !!branch]);

  function beginAction() {
    pendingNavigation.current = null;
    setSpeechNavigation(null);
    audio.cancel();
    return ++actionVersion.current;
  }
  function navigate(ply: number, options?: { silent?: boolean }) {
    if (!game) return;
    const next = Math.max(0, Math.min(game.frames.length - 1, ply));
    const nextKey = `${next}:`;
    const changed = activeKey.current !== nextKey;
    if (changed) {
      const eventId = beginAction();
      if (!options?.silent) {
        const target = game.frames[next];
        if (!branch && next === cursor.ply + 1) audio.move(target.san, `${eventId}:board`);
        else audio.play("move", `${eventId}:board`);
        // A mainline visit speaks only the explanation available on arrival.
        // A later background review update is not a new navigation event.
        setSpeechNavigation({key: nextKey, eventId: `${id}:${eventId}`, awaitAnalysis: false});
      }
      activeKey.current = nextKey;
    }
    setCursor({ ply: next, branch: null, step: 0 });
    setExplanationKey(null);
    fail("");
  }
  function selectStep(value: number) {
    setExplanationKey(null);
    const next = Math.max(0, Math.min(maximum, value));
    if (branch && next === 0) navigate(branch.root);
    else if (branch) selectBranch(branch, next);
    else navigate(next);
  }
  function step(delta: number) {
    if (game) selectStep(current + delta);
  }
  function returnToGame() {
    if (branch) navigate(branch.returnPly, { silent: true });
  }
  function selectBranch(selected: Branch, step: number) {
    const next = Math.max(0, Math.min(selected.moves.length, step));
    const nextKey = `${selected.root}:${selected.moves.slice(0, next).join(",")}`;
    if (activeKey.current !== nextKey) {
      const eventId = beginAction();
      setSpeechNavigation({key: nextKey, eventId: `${id}:${eventId}`, awaitAnalysis: true});
      const forward = branch?.id === selected.id && next === cursor.step + 1
        || !branch && selected.root === cursor.ply && next === 1;
      // The last complete position can display immediately. Other variation
      // steps keep the old board visible until their guarded request succeeds.
      if (branchPosition?.key === nextKey) {
        if (forward) audio.move(branchPosition.value.san, `${eventId}:board`);
        else audio.play("move", `${eventId}:board`);
      } else pendingNavigation.current = { key: nextKey, eventId, forward };
      activeKey.current = nextKey;
    }
    setCursor({ ply: selected.root, branch: selected.id, step: next });
    setExplanationKey(null);
  }
  function escape() {
    if (explanationKey) setExplanationKey(null);
    else returnToGame();
  }
  const keyboard = useRef({ step, escape });
  keyboard.current = { step, escape };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      // Modal choices and native popovers own Escape and focus navigation.
      if (document.querySelector(":modal, :popover-open")) return;
      if (
        (event.target as HTMLElement).closest(
          "input,select,textarea,[contenteditable=true]",
        )
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        keyboard.current.escape();
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        keyboard.current.step(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  function addBranch(moves: string[], sans: string[]) {
    const existing = branches.find(
      (b) => b.root === root && b.moves.join() === moves.join(),
    );
    const extending =
      !existing && branch && cursor.step === branch.moves.length;
    const branchId = existing?.id ?? (extending ? branch.id : nextId.current++);
    const returnPly = branch?.returnPly ?? cursor.ply;
    const updated = { id: branchId, root, moves, sans, returnPly };
    if (extending || existing)
      setBranches((values) =>
        values.map((b) => (b.id === branchId ? updated : b)),
      );
    else setBranches((values) => [...values, updated]);
    setCursor({ ply: root, branch: branchId, step: moves.length });
  }
  async function play(from: string, to: string, promotion?: string) {
    if (!frame || moving) return null;
    const requestKey = key;
    const moves = [...path, from + to + (promotion || "")];
    if (moves.length > 128) {
      fail(
        "This variation has reached 128 moves. Return to the game to start another.",
      );
      return null;
    }
    const eventId = beginAction();
    setMoving(true);
    fail("");
    try {
      const next = await read(
        api.POST("/api/games/{game_id}/position", {
          params: { path: { game_id: id } },
          body: { ply: root, moves },
        }),
      );
      if (!mounted.current || activeKey.current !== requestKey || actionVersion.current !== eventId) return null;
      if (!next.san)
        throw new Error("The server returned a variation without its move.");
      addBranch(moves, [
        ...(branch ? branch.sans.slice(0, cursor.step) : []),
        next.san,
      ]);
      const nextKey = `${root}:${moves.join(",")}`;
      activeKey.current = nextKey;
      setBranchPosition({ key: nextKey, value: next });
      setExplanationKey(null);
      audio.move(next.san, `${eventId}:board`);
      setSpeechNavigation({key: nextKey, eventId: `${id}:${eventId}`, awaitAnalysis: true});
      return {
        root,
        moves,
      };
    } catch (e) {
      if (mounted.current && activeKey.current === requestKey && actionVersion.current === eventId)
        fail((e as Error).message);
    } finally {
      if (mounted.current) setMoving(false);
    }
    return null;
  }

  return {
    cursor,
    branches,
    branch,
    path,
    root,
    key,
    frame,
    branchPosition,
    orientation,
    moving,
    explanationKey,
    speechNavigation: speechNavigation?.key === key ? speechNavigation : null,
    current,
    maximum,
    navigate,
    selectStep,
    step,
    returnToGame,
    play,
    flip: () =>
      setOrientation((value) => (value === "white" ? "black" : "white")),
    beginScrubbing: () => {
      beginAction();
      scrubOrigin.current = activeKey.current;
    },
    finishScrubbing: (ply: number) => {
      const origin = scrubOrigin.current;
      scrubOrigin.current = null;
      if (origin !== null && origin !== `${ply}:` && activeKey.current === `${ply}:`) {
        const eventId = beginAction();
        audio.play("move", `${eventId}:board`);
        setSpeechNavigation({key: activeKey.current, eventId: `${id}:${eventId}`, awaitAnalysis: false});
      }
    },
    toggleExplanation: () =>
      setExplanationKey((value) => (value === key ? null : key)),
    selectBranch,
  };
}

export type GameExploration = ReturnType<typeof useGameExploration>;
