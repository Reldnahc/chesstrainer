import { expect, test, type Page } from "@playwright/test";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, transformWithEsbuild, type ViteDevServer } from "vite";

// Keep playback observable without replacing the production navigation or graph.
// A stable scope matches AudioProvider's contract, including across rerenders.
const audioStub = `
window.gameAudioEvents = [];
const scope = {
  move(san, eventId, options) { window.gameAudioEvents.push({kind: "move", san, eventId, options}); },
  play(cue, eventId, options) { window.gameAudioEvents.push({kind: "play", cue, eventId, options}); },
  cancel() { window.gameAudioEvents.push({kind: "cancel"}); },
};
export function useAudioScope() { return scope; }
`;

const harness = `
import React, { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { useGameExploration } from "/src/gameReview/useGameExploration.ts";
import { usePositionAnalysis } from "/src/gameReview/usePositionAnalysis.ts";
import EvaluationGraph from "/src/EvaluationGraph.tsx";
import "/src/game-review.css";
const report = label => ({label, white_score: {kind: "cp", value: 20}});
const makeGame = () => ({id: "audio-fixture", orientation: "white", rating: 1000, frames: [
  {san: "", actor: null, turn: "white", number: 1, report: null},
  {san: "e4", actor: "white", turn: "black", number: 1, report: report("Brilliant")},
  {san: "e5", actor: "black", turn: "white", number: 1, report: report("Blunder")},
  {san: "Nf3", actor: "white", turn: "black", number: 2, report: report("Good")},
  {san: "Nc6", actor: "black", turn: "white", number: 2, report: report("Great")},
  {san: "Bb5+", actor: "white", turn: "black", number: 3, report: report("Mistake")},
].map(frame => ({...frame, fen: "fixture", legal_moves: [], termination: null, result: null}))});

function Fixture() {
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState("idle");
  const fail = useCallback(value => setError(String(value)), []);
  const exploration = useGameExploration("audio-fixture", 0, game, fail);
  const analysis = usePositionAnalysis({id: "audio-fixture", rating: 1000, epoch: 0,
    root: exploration.root, path: exploration.path, positionKey: exploration.key, browse: false});
  async function play(from, to) {
    setOutcome("pending");
    const played = await exploration.play(from, to);
    setOutcome(played ? "accepted" : "ignored");
    if (played) {
      const result = await analysis.request(played.root, played.moves);
      played.announceAnalysis(result?.report?.label);
      setOutcome("analyzed");
    }
  }
  return <main style={{padding: 8, maxWidth: 600}}>
    <button onClick={() => setGame(makeGame())}>Load game</button>
    <button onClick={exploration.flip}>Flip board</button>
    <button onClick={() => exploration.navigate(0)}>Start</button>
    <button onClick={() => exploration.step(1)}>Next</button>
    <button onClick={() => exploration.step(-1)}>Previous</button>
    <button onClick={() => exploration.navigate(2)}>Jump to opponent</button>
    <button onClick={exploration.returnToGame}>Return to game</button>
    <button onClick={() => play("e2", "e4")}>Play e4</button>
    <button onClick={() => play("d7", "d5")}>Play d5</button>
    <label>Learner quality<select aria-label="Learner quality" value={game?.frames[1].report.label ?? "Brilliant"}
      onChange={event => setGame(current => ({...current, frames: current.frames.map((frame, index) =>
        index === 1 ? {...frame, report: report(event.target.value)} : frame)}))}>
      {["Brilliant", "Great", "Best", "Good", "Book", "Inaccuracy", "Miss", "Mistake", "Blunder"].map(label =>
        <option key={label}>{label}</option>)}
    </select></label>
    <output data-testid="current">{exploration.key}</output>
    <output data-testid="frame">{exploration.frame ? exploration.frame.san || "start" : "loading"}</output>
    <output data-testid="orientation">{exploration.orientation}</output>
    <output data-testid="branches">{exploration.branches.length}</output>
    <output data-testid="outcome">{outcome}</output>
    <output data-testid="error">{error}</output>
    {exploration.branches.map(branch => <button key={branch.id}
      onClick={() => exploration.selectBranch(branch, branch.moves.length)}>Select variation {branch.id}</button>)}
    {game && <EvaluationGraph frames={game.frames} selected={exploration.cursor.ply}
      onSelect={exploration.navigate} onScrubStart={exploration.beginScrubbing}
      onScrubSelect={ply => exploration.navigate(ply, {silent: true})}
      onScrubEnd={exploration.finishScrubbing} />}
  </main>;
}
createRoot(document.getElementById("root")).render(<React.StrictMode><Fixture /></React.StrictMode>);
`;

type AudioEvent = { kind: "move" | "play" | "cancel"; san?: string; cue?: string; eventId?: string };
type AudioWindow = Window & { gameAudioEvents: AudioEvent[] };
let server: ViteDevServer;
let origin: string;

test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    plugins: [react(), {
      name: "game-audio-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id === "/game-audio-fixture.tsx") return "\0game-audio-fixture.tsx";
        if (/(?:^|\/)audio\/AudioProvider(?:\.tsx)?$/.test(id)) return "\0game-audio-provider";
      },
      async load(id) {
        if (id === "\0game-audio-provider") return audioStub;
        if (id === "\0game-audio-fixture.tsx")
          return (await transformWithEsbuild(harness, "game-audio-fixture.tsx", {loader: "tsx", jsx: "automatic"})).code;
      },
      configureServer(vite) {
        vite.middlewares.use("/__game-audio", async (_request, response, next) => {
          try {
            const html = await vite.transformIndexHtml("/__game-audio", `<!doctype html>
              <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
              <body><div id="root"></div><script type="module" src="/game-audio-fixture.tsx"></script></body></html>`);
            response.setHeader("Content-Type", "text/html");
            response.end(html);
          } catch (error) { next(error); }
        });
      },
    }],
    server: {host: "127.0.0.1", port: 0},
  });
  await server.listen();
  origin = server.resolvedUrls!.local[0];
});

test.afterAll(async () => { await server?.close(); });

test.beforeEach(async ({page}) => {
  await page.route("**/api/games/audio-fixture/position", route => {
    const {ply, moves} = route.request().postDataJSON();
    return route.fulfill({json: position(ply, moves)});
  });
  await page.route("**/api/games/audio-fixture/analyze", route => route.fulfill({json: {
    report: {label: "Brilliant"}, score: null, best_move: null,
  }}));
  await page.goto(`${origin}__game-audio`);
  await page.getByRole("button", {name: "Load game", exact: true}).click();
  await expect(page.locator(".game-evaluation-plot")).toBeVisible();
});

function position(ply: number, moves: string[]) {
  return {fen: "fixture", legal_moves: [], san: moves.at(-1) === "d7d5" ? "d5" : "e4",
    turn: (ply + moves.length) % 2 ? "black" : "white", termination: null, result: null};
}

async function sounds(page: Page) {
  return page.evaluate(() => (window as unknown as AudioWindow).gameAudioEvents.filter(event => event.kind !== "cancel"));
}

async function clearSounds(page: Page) {
  await page.evaluate(() => { (window as unknown as AudioWindow).gameAudioEvents.length = 0; });
}

async function twoMoveVariation(page: Page) {
  await page.getByRole("button", {name: "Play e4", exact: true}).click();
  await expect(page.getByTestId("outcome")).toHaveText("analyzed");
  await page.getByRole("button", {name: "Play d5", exact: true}).click();
  await expect(page.getByTestId("outcome")).toHaveText("analyzed");
  await expect(page.getByTestId("frame")).toHaveText("d5");
  await clearSounds(page);
}

test("hydration, flipping, report refresh and no-op navigation remain silent", async ({page}) => {
  expect(await sounds(page)).toEqual([]);
  await page.getByRole("button", {name: "Flip board", exact: true}).click();
  await expect(page.getByTestId("orientation")).toHaveText("black");
  await page.getByRole("button", {name: "Start", exact: true}).click();
  await page.getByRole("button", {name: "Previous", exact: true}).click();
  await page.getByRole("combobox", {name: "Learner quality"}).selectOption("Blunder");
  expect(await sounds(page)).toEqual([]);
  await page.getByRole("button", {name: "Next", exact: true}).click();
  await expect(page.getByTestId("current")).toHaveText("1:");
  await clearSounds(page);
  await page.getByRole("combobox", {name: "Learner quality"}).selectOption("Great");
  expect(await sounds(page)).toEqual([]);
});

test("explicit navigation uses server SAN forwards and neutral placement backwards or on jumps", async ({page}) => {
  await page.getByRole("button", {name: "Next", exact: true}).click();
  expect(await sounds(page)).toMatchObject([{kind: "move", san: "e4"}, {kind: "play", cue: "brilliant"}]);
  await clearSounds(page);
  await page.getByRole("button", {name: "Next", exact: true}).click();
  expect(await sounds(page)).toMatchObject([{kind: "move", san: "e5"}]);
  await page.getByRole("button", {name: "Start", exact: true}).click();
  await clearSounds(page);
  await page.getByRole("button", {name: "Jump to opponent", exact: true}).click();
  expect(await sounds(page)).toMatchObject([{kind: "play", cue: "move"}]);
  await page.getByRole("button", {name: "Start", exact: true}).click();
  await page.getByRole("button", {name: "Next", exact: true}).click();
  await clearSounds(page);
  await page.getByRole("button", {name: "Previous", exact: true}).click();
  expect(await sounds(page)).toMatchObject([{kind: "play", cue: "move"}]);
});

test("quality accents belong to the learner and only supported labels have a cue", async ({page}) => {
  await page.getByRole("button", {name: "Flip board", exact: true}).click();
  const supported = new Map([["Brilliant", "brilliant"], ["Great", "great"], ["Miss", "miss"],
    ["Mistake", "mistake"], ["Blunder", "blunder"]]);
  const eventIds: string[] = [];
  for (const label of ["Brilliant", "Great", "Miss", "Mistake", "Blunder", "Good", "Best", "Book", "Inaccuracy"]) {
    await page.getByRole("button", {name: "Start", exact: true}).click();
    await page.getByRole("combobox", {name: "Learner quality"}).selectOption(label);
    await clearSounds(page);
    await page.getByRole("button", {name: "Next", exact: true}).click();
    const events = await sounds(page);
    expect(events.filter(event => event.kind === "move")).toMatchObject([{san: "e4"}]);
    expect(events.filter(event => event.kind === "play").map(event => event.cue)).toEqual(supported.has(label) ? [supported.get(label)] : []);
    eventIds.push(events[0].eventId!);
  }
  expect(new Set(eventIds).size).toBe(eventIds.length);
  await clearSounds(page);
  await page.getByRole("button", {name: "Next", exact: true}).click();
  expect(await sounds(page)).toMatchObject([{kind: "move", san: "e5"}]);
});

test("graph scrub previews stay silent, release has one neutral cue, and interruption stays silent", async ({page, context}, info) => {
  const plot = page.locator(".game-evaluation-plot");
  await plot.evaluate(element => element.addEventListener("pointerdown", event => {
    element.setAttribute("data-test-pointer", String((event as PointerEvent).pointerId));
  }));
  const point = async (ply: number) => {
    const bounds = (await plot.boundingBox())!;
    const node = plot.locator(`[data-ply="${ply}"]`);
    return {x: bounds.x + Number(await node.getAttribute("cx")), y: bounds.y + 25};
  };
  const touch = info.project.name === "mobile" ? await context.newCDPSession(page) : null;
  const down = async (point: {x: number; y: number}) => {
    if (touch) await touch.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [point]});
    else { await page.mouse.move(point.x, point.y); await page.mouse.down(); }
  };
  const move = async (point: {x: number; y: number}) => {
    if (touch) await touch.send("Input.dispatchTouchEvent", {type: "touchMove", touchPoints: [point]});
    else await page.mouse.move(point.x, point.y);
  };
  const up = async () => {
    if (touch) await touch.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
    else await page.mouse.up();
  };
  const first = await point(1), third = await point(3), fifth = await point(5);
  await down(first);
  await move(third);
  await expect(page.getByTestId("current")).toHaveText("3:");
  expect(await sounds(page)).toEqual([]);
  await move(fifth);
  await expect(page.getByTestId("current")).toHaveText("5:");
  expect(await sounds(page)).toEqual([]);
  await up();
  expect(await sounds(page)).toMatchObject([{kind: "play", cue: "move"}]);
  await clearSounds(page);
  const restartedFirst = await point(1), restartedThird = await point(3);
  await down(restartedFirst);
  await move(restartedThird);
  await expect(page.getByTestId("current")).toHaveText("3:");
  if (touch) await touch.send("Input.dispatchTouchEvent", {type: "touchCancel", touchPoints: []});
  else {
    await plot.evaluate(element => element.releasePointerCapture(Number(element.getAttribute("data-test-pointer"))));
    await up();
  }
  expect(await sounds(page)).toEqual([]);
  await plot.locator('[data-ply="3"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("current")).toHaveText("4:");
  expect(await sounds(page)).toMatchObject([{kind: "move", san: "Nc6"}]);
  await touch?.detach();
});

test("a delayed move response cannot play after navigating away and back to its source", async ({page}) => {
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/games/audio-fixture/position", async route => {
    const {ply, moves} = route.request().postDataJSON();
    await gate;
    await route.fulfill({json: position(ply, moves)});
  });
  try {
    const requested = page.waitForRequest(request => request.url().endsWith("/position"));
    await page.getByRole("button", {name: "Play e4", exact: true}).click();
    await requested;
    await page.getByRole("button", {name: "Next", exact: true}).click();
    await page.getByRole("button", {name: "Start", exact: true}).click();
    await clearSounds(page);
    release();
    await expect(page.getByTestId("outcome")).toHaveText("ignored");
    await expect(page.getByTestId("current")).toHaveText("0:");
    await expect(page.getByTestId("branches")).toHaveText("0");
    expect(await sounds(page)).toEqual([]);
  } finally { release(); }
});

test("accepted moves announce their analysis once, while a later navigation invalidates delayed quality", async ({page}) => {
  await page.getByRole("button", {name: "Play e4", exact: true}).click();
  await expect(page.getByTestId("outcome")).toHaveText("analyzed");
  expect(await sounds(page)).toMatchObject([{kind: "move", san: "e4"}, {kind: "play", cue: "brilliant"}]);
  await clearSounds(page);
  await page.getByRole("button", {name: "Play d5", exact: true}).click();
  await expect(page.getByTestId("current")).toHaveText("0:e2e4,d7d5");
  await expect(page.getByTestId("outcome")).toHaveText("analyzed");
  expect(await sounds(page)).toMatchObject([{kind: "move", san: "d5"}]);

  await page.reload();
  await page.getByRole("button", {name: "Load game", exact: true}).click();
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/games/audio-fixture/analyze", async route => {
    await gate;
    await route.fulfill({json: {report: {label: "Brilliant"}, score: null, best_move: null}});
  });
  try {
    const requested = page.waitForRequest(request => request.url().endsWith("/analyze"));
    await page.getByRole("button", {name: "Play e4", exact: true}).click();
    await requested;
    await clearSounds(page);
    await page.getByRole("button", {name: "Return to game", exact: true}).click();
    expect(await sounds(page)).toEqual([]);
    await page.getByRole("button", {name: "Select variation 1", exact: true}).click();
    await expect(page.getByTestId("current")).toHaveText("0:e2e4");
    await expect(page.getByTestId("frame")).toHaveText("e4");
    await clearSounds(page);
    release();
    await expect(page.getByTestId("outcome")).toHaveText("analyzed");
    expect(await sounds(page)).toEqual([]);
  } finally { release(); }
});

test("variation navigation waits for the accepted position before its neutral or SAN cue", async ({page}) => {
  await twoMoveVariation(page);
  for (const {button, length, san, expected} of [
    {button: "Previous", length: 1, san: "e4", expected: {kind: "play", cue: "move"}},
    {button: "Next", length: 2, san: "d5", expected: {kind: "move", san: "d5"}},
  ]) {
    let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/games/audio-fixture/position", async route => {
      const {ply, moves} = route.request().postDataJSON();
      if (moves.length !== length) return route.fallback();
      await gate;
      await route.fulfill({json: position(ply, moves)});
    });
    try {
      await clearSounds(page);
      const requested = page.waitForRequest(request => request.url().endsWith("/position")
        && request.postDataJSON().moves.length === length);
      await page.getByRole("button", {name: button, exact: true}).click();
      await requested;
      await expect(page.getByTestId("frame")).toHaveText("loading");
      expect(await sounds(page)).toEqual([]);
      release();
      await expect(page.getByTestId("frame")).toHaveText(san);
      expect(await sounds(page)).toMatchObject([expected]);
    } finally { release(); }
  }
});

test("failed variation navigation never announces a position that was not displayed", async ({page}) => {
  await twoMoveVariation(page);
  await page.route("**/api/games/audio-fixture/position", route => {
    if (route.request().postDataJSON().moves.length !== 1) return route.fallback();
    return route.fulfill({status: 503, json: {detail: "Variation position unavailable"}});
  });
  await page.getByRole("button", {name: "Previous", exact: true}).click();
  await expect(page.getByTestId("error")).toHaveText("Variation position unavailable");
  await expect(page.getByTestId("frame")).toHaveText("loading");
  expect(await sounds(page)).toEqual([]);
});

test("leaving pending variation navigation discards its eventual cue", async ({page}) => {
  await twoMoveVariation(page);
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/games/audio-fixture/position", async route => {
    const {ply, moves} = route.request().postDataJSON();
    if (moves.length !== 1) return route.fallback();
    await gate;
    await route.fulfill({json: position(ply, moves)});
  });
  try {
    const requested = page.waitForRequest(request => request.url().endsWith("/position")
      && request.postDataJSON().moves.length === 1);
    await page.getByRole("button", {name: "Previous", exact: true}).click();
    await requested;
    await expect(page.getByTestId("frame")).toHaveText("loading");
    expect(await sounds(page)).toEqual([]);
    await page.getByRole("button", {name: "Start", exact: true}).click();
    await expect(page.getByTestId("frame")).toHaveText("start");
    await clearSounds(page);
    const delivered = page.waitForResponse(response => response.url().endsWith("/position")
      && response.request().postDataJSON().moves.length === 1);
    release();
    await (await delivered).finished();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByTestId("frame")).toHaveText("start");
    expect(await sounds(page)).toEqual([]);
  } finally { release(); }
});
