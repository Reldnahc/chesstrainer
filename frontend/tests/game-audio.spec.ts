import { expect, test, type Page } from "./helpers/browserTest";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, transformWithEsbuild, type ViteDevServer } from "vite";
import { devRecordingAssets } from "../vite.shared";
import { isolatedServer } from "./helpers/vite";

// Keep playback observable without replacing the production navigation or graph.
// A stable scope matches AudioProvider's contract, including across rerenders.
const audioStub = `
window.gameAudioEvents = [];
const scope = {
  move(san, eventId, options) { window.gameAudioEvents.push({kind: "move", san, eventId, options}); },
  play(cue, eventId, options) { window.gameAudioEvents.push({kind: "play", cue, eventId, options}); },
  cancel() { window.gameAudioEvents.push({kind: "cancel"}); },
  // The navigation rules, written in terms of the two recorded cues as AudioProvider does.
  advance(forward, san, eventId) { if (forward) scope.move(san, eventId); else scope.play("move", eventId); },
  step(from, to, san, eventId) { scope.advance(to === from + 1, san, eventId); },
  moveOr(san, eventId, options) { if (san) scope.move(san, eventId, options); else scope.play("move", eventId, options); },
};
export function useAudioScope() { return scope; }
`;

const harness = `
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { errorMessage } from "/src/api.ts";
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
  // The page's error channel, as game review passes it: fail reports, dismiss clears.
  const errors = useMemo(() => ({fail: value => setError(errorMessage(value)), dismiss: () => setError("")}), []);
  const exploration = useGameExploration("audio-fixture", 0, game, errors);
  const analysis = usePositionAnalysis({id: "audio-fixture", rating: 1000, epoch: 0,
    root: exploration.root, path: exploration.path, positionKey: exploration.key, browse: false});
  async function play(from, to) {
    setOutcome("pending");
    const played = await exploration.play(from, to);
    setOutcome(played ? "accepted" : "ignored");
    if (played) {
      await analysis.request(played.root, played.moves);
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
    <output data-testid="speech-navigation">{JSON.stringify(exploration.speechNavigation)}</output>
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

type AudioEvent = {
  kind: "move" | "play" | "cancel";
  san?: string;
  cue?: string;
  eventId?: string;
};
type AudioWindow = Window & { gameAudioEvents: AudioEvent[] };
let server: ViteDevServer;
let origin: string;

test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    plugins: [
      react(),
      devRecordingAssets(),
      {
        name: "game-audio-fixture",
        enforce: "pre",
        resolveId(id) {
          if (id === "/game-audio-fixture.tsx") return "\0game-audio-fixture.tsx";
          if (/(?:^|\/)audio\/AudioProvider(?:\.tsx)?$/.test(id)) return "\0game-audio-provider";
        },
        async load(id) {
          if (id === "\0game-audio-provider") return audioStub;
          if (id === "\0game-audio-fixture.tsx")
            return (
              await transformWithEsbuild(harness, "game-audio-fixture.tsx", {
                loader: "tsx",
                jsx: "automatic",
              })
            ).code;
        },
        configureServer(vite) {
          // eslint-disable-next-line @typescript-eslint/no-misused-promises -- the handler catches every failure and passes it to next
          vite.middlewares.use("/__game-audio", async (_request, response, next) => {
            try {
              const html = await vite.transformIndexHtml(
                "/__game-audio",
                `<!doctype html>
              <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
              <body><div id="root"></div><script type="module" src="/game-audio-fixture.tsx"></script></body></html>`,
              );
              response.setHeader("Content-Type", "text/html");
              response.end(html);
            } catch (error) {
              next(error);
            }
          });
        },
      },
    ],
    ...(await isolatedServer()),
  });
  await server.listen();
  origin = server.resolvedUrls!.local[0];
});

test.afterAll(async () => {
  await server?.close();
});

// A harness that drifts from the hooks it drives must fail loudly, not throw unseen.
const pageErrors = new WeakMap<Page, Error[]>();
test.beforeEach(async ({ page }) => {
  const errors: Error[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", error => errors.push(error));
  await page.route("**/api/games/audio-fixture/position", route => {
    const { ply, moves } = route.request().postDataJSON();
    return route.fulfill({ json: position(ply, moves) });
  });
  await page.route("**/api/games/audio-fixture/analyze", route =>
    route.fulfill({
      json: {
        report: { label: "Brilliant" },
        score: null,
        best_move: null,
      },
    }),
  );
  await page.goto(`${origin}__game-audio`);
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await expect(page.locator(".game-evaluation-plot")).toBeVisible();
});

function position(ply: number, moves: string[]) {
  return {
    fen: "fixture",
    legal_moves: [],
    san: moves.at(-1) === "d7d5" ? "d5" : "e4",
    turn: (ply + moves.length) % 2 ? "black" : "white",
    termination: null,
    result: null,
  };
}

async function sounds(page: Page) {
  return page.evaluate(() =>
    (window as unknown as AudioWindow).gameAudioEvents.filter(event => event.kind !== "cancel"),
  );
}

async function clearSounds(page: Page) {
  await page.evaluate(() => {
    (window as unknown as AudioWindow).gameAudioEvents.length = 0;
  });
}

test("a delayed move response cannot play after navigating away and back to its source", async ({
  page,
}) => {
  let release = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  await page.route("**/api/games/audio-fixture/position", async route => {
    const { ply, moves } = route.request().postDataJSON();
    await gate;
    await route.fulfill({ json: position(ply, moves) });
  });
  try {
    const requested = page.waitForRequest(request => request.url().endsWith("/position"));
    await page.getByRole("button", { name: "Play e4", exact: true }).click();
    await requested;
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await clearSounds(page);
    release();
    await expect(page.getByTestId("outcome")).toHaveText("ignored");
    await expect(page.getByTestId("current")).toHaveText("0:");
    await expect(page.getByTestId("branches")).toHaveText("0");
    expect(await sounds(page)).toEqual([]);
  } finally {
    release();
  }
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) ?? [], "uncaught page errors").toEqual([]);
});
