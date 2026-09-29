import { useEffect, useRef, useState } from "react";
import { api, read } from "../api";
import { rememberGamePly } from "../navigation";
import type { Branch, Cursor, Game, Position } from "./types";

/** Owns variation history and navigation without mutating the original game. */
export function useGameExploration(
  id: string,
  initialPly: number,
  game: Game | null,
  fail: (message: string) => void,
) {
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
  const nextId = useRef(1);
  const mounted = useRef(false);
  const activeKey = useRef("");
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
  useEffect(() => {
    if (game && !branch) rememberGamePly(id, cursor.ply);
  }, [id, !!game, cursor.ply, !!branch]);

  useEffect(() => {
    if (!branch) return;
    let active = true;
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
        if (active) setBranchPosition({ key, value });
      })
      .catch((e) => {
        if (active) fail(e.message);
      });
    return () => {
      active = false;
    };
    // The key includes the entire variation, including repetition history.
  }, [id, key, !!branch]);

  function navigate(ply: number) {
    setCursor({ ply, branch: null, step: 0 });
    setExplanationKey(null);
    fail("");
  }
  function selectStep(value: number) {
    setExplanationKey(null);
    const next = Math.max(0, Math.min(maximum, value));
    if (branch && next === 0) navigate(branch.root);
    else if (branch) setCursor((c) => ({ ...c, step: next }));
    else navigate(next);
  }
  function step(delta: number) {
    if (game) selectStep(current + delta);
  }
  function returnToGame() {
    if (branch) navigate(branch.returnPly);
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
    setMoving(true);
    fail("");
    try {
      const next = await read(
        api.POST("/api/games/{game_id}/position", {
          params: { path: { game_id: id } },
          body: { ply: root, moves },
        }),
      );
      if (!mounted.current || activeKey.current !== requestKey) return null;
      if (!next.san)
        throw new Error("The server returned a variation without its move.");
      addBranch(moves, [
        ...(branch ? branch.sans.slice(0, cursor.step) : []),
        next.san,
      ]);
      setBranchPosition({ key: `${root}:${moves.join(",")}`, value: next });
      setExplanationKey(null);
      return { root, moves };
    } catch (e) {
      if (mounted.current && activeKey.current === requestKey)
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
    current,
    maximum,
    navigate,
    selectStep,
    step,
    returnToGame,
    play,
    flip: () =>
      setOrientation((value) => (value === "white" ? "black" : "white")),
    toggleExplanation: () =>
      setExplanationKey((value) => (value === key ? null : key)),
    selectBranch: (selected: Branch, step: number) => {
      setCursor({ ply: selected.root, branch: selected.id, step });
      setExplanationKey(null);
    },
  };
}

export type GameExploration = ReturnType<typeof useGameExploration>;
