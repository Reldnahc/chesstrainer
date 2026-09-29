import { expect, test, type Locator, type Page } from "@playwright/test";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, transformWithEsbuild, type ViteDevServer } from "vite";

// Real production components in a small browser fixture allow changes to board
// inputs while a modal is open, without coupling these contracts to an engine.
const harness = `
import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Board from "/src/Board.tsx";
import EvidenceDialog from "/src/EvidenceDialog.tsx";
import { useGameExploration } from "/src/gameReview/useGameExploration.ts";
import "/src/foundation.css";
import "/src/base.css";
import "/src/board.css";
import "/src/evidence.css";

const initialFen = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1";
const changedFen = "4k3/8/P7/8/8/8/8/4K3 w - - 0 2";
const game = { id: "modal-fixture", orientation: "white", frames: [
  {fen: changedFen}, {fen: initialFen}, {fen: changedFen},
] };

function Fixture() {
  const [fen, setFen] = useState(initialFen);
  const [disabled, setDisabled] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [choices, setChoices] = useState(["q", "r", "b", "n"]);
  const [moves, setMoves] = useState([]);
  const [evidence, setEvidence] = useState(false);
  const [error, setError] = useState("");
  const fail = useCallback(value => setError(String(value)), []);
  const exploration = useGameExploration("modal-fixture", 1, game, fail);
  useEffect(() => {
    const update = event => {
      if (event.detail === "disable") setDisabled(true);
      if (event.detail === "position") setFen(changedFen);
      if (event.detail === "unmount") setMounted(false);
      if (event.detail === "restricted") setChoices(["r", "n"]);
      if (event.detail === "reset") {
        setFen(initialFen);
        setDisabled(false);
        setMounted(true);
        setChoices(["q", "r", "b", "n"]);
      }
    };
    window.addEventListener("modal-fixture-update", update);
    return () => window.removeEventListener("modal-fixture-update", update);
  }, []);
  return <div style={{padding: 16, maxWidth: 512}}>
    <button onClick={() => exploration.toggleExplanation()}>Toggle explanation</button>
    <button onClick={() => setEvidence(true)}>Open evidence</button>
    <output data-testid="ply">{exploration.current}</output>
    <output data-testid="explanation">{exploration.explanationKey ? "open" : "closed"}</output>
    <output data-testid="moves">{moves.join(",")}</output>
    <output data-testid="error">{error}</output>
    {mounted && <Board fen={fen} orientation="white" disabled={disabled}
      legalMoves={choices.map(promotion => ({from_square: "a7", to_square: "a8", promotion, capture: false}))}
      onMove={(from, to, promotion) => setMoves(values => [...values, from + to + promotion])} />}
    <button>After board</button>
    {evidence && <EvidenceDialog id="modal-fixture" onClose={() => setEvidence(false)} fail={fail} />}
  </div>;
}
createRoot(document.getElementById("root")).render(<React.StrictMode><Fixture /></React.StrictMode>);
`;

let server: ViteDevServer;
let origin: string;

test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    plugins: [react(), {
      name: "modal-contract-fixture",
      resolveId(id) {
        if (id === "/modal-contract.tsx") return "\0modal-contract.tsx";
      },
      async load(id) {
        if (id === "\0modal-contract.tsx")
          return (await transformWithEsbuild(harness, "modal-contract.tsx", { loader: "tsx", jsx: "automatic" })).code;
      },
      configureServer(vite) {
        vite.middlewares.use("/__modal-contract", async (_request, response, next) => {
          try {
            const html = await vite.transformIndexHtml("/__modal-contract", `<!doctype html>
              <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
              <body><div id="root"></div><script type="module" src="/modal-contract.tsx"></script></body></html>`);
            response.setHeader("Content-Type", "text/html");
            response.end(html);
          } catch (error) {
            next(error);
          }
        });
      },
    }],
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  origin = server.resolvedUrls!.local[0];
});

test.afterAll(async () => {
  await server?.close();
});

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/evidence/modal-fixture", route => route.fulfill({ json: {
    fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1",
    played_san: "a8=N", loss_cp: 0, allows_mate: false, mate_lost: false,
    candidates: [{ san: "a8=N", score: { kind: "cp", value: 0 }, pv: ["a7a8n"] }],
    classifications: [{ skill: "promotion", provider: "local_rules", run_id: "modal-audit", explanation: "Promotion fixture." }],
  } }));
  await page.goto(`${origin}__modal-contract`);
  await expect(page.locator(".board-shell")).toBeVisible();
});

async function updateFixture(page: Page, action: "disable" | "position" | "unmount" | "restricted" | "reset") {
  await page.evaluate(detail => window.dispatchEvent(new CustomEvent("modal-fixture-update", { detail })), action);
}

async function choosePromotion(page: Page) {
  const board = page.locator(".board-shell").first();
  await board.locator('[data-square="a7"]').click();
  await board.locator('[data-square="a8"]').click();
  const dialog = page.getByRole("dialog", { name: "Choose promotion" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function dragToPromotion(page: Page) {
  const board = page.locator(".board-shell");
  const source = (await board.locator('[data-square="a7"]').boundingBox())!;
  const target = (await board.locator('[data-square="a8"]').boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await expect(board.locator('[data-legal-destination="a8"]')).toBeVisible();
}

async function tabTo(page: Page, direction: "Tab" | "Shift+Tab", target: Locator) {
  await page.keyboard.press(direction);
  // Chromium includes browser chrome at a native dialog's tab boundary. It may
  // also focus the dialog's scroll container on small screens. Neither stop
  // may focus an inert underlying page control.
  for (let stop = 0; stop < 2; stop++) {
    const nativeStop = await page.evaluate(() => {
      const active = document.activeElement;
      if (active === document.body) return "chrome";
      if (active instanceof HTMLDialogElement && active.matches(":modal")) return "dialog";
      return null;
    });
    if (nativeStop === "chrome")
      expect(await page.evaluate(() => document.hasFocus())).toBe(false);
    else if (nativeStop === "dialog")
      expect(await page.evaluate(() => {
        const active = document.activeElement!;
        return active.scrollHeight > active.clientHeight;
      })).toBe(true);
    else break;
    await page.keyboard.press(direction);
  }
  await expect(target).toBeFocused();
}

test("promotion is a native modal with contained focus and Escape restores the board", async ({ page }) => {
  const dialog = await choosePromotion(page);
  expect(await dialog.evaluate(element => element instanceof HTMLDialogElement && element.matches(":modal"))).toBe(true);
  const first = dialog.getByRole("button", { name: "Queen", exact: true });
  const last = dialog.getByRole("button", { name: "Cancel", exact: true });
  await expect(first).toBeFocused();
  await page.getByRole("button", { name: "After board", exact: true }).evaluate(element => element.focus());
  await expect(first).toBeFocused();
  await tabTo(page, "Shift+Tab", last);
  await tabTo(page, "Tab", first);
  for (const name of ["Rook", "Bishop", "Knight", "Cancel", "Queen"]) {
    await tabTo(page, "Tab", dialog.getByRole("button", { name, exact: true }));
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".board-shell")).toBeFocused();
  await expect(page.getByTestId("moves")).toBeEmpty();
  await expect(page.locator("[data-legal-destination]")).toHaveCount(0);
  await choosePromotion(page);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".board-shell")).toBeFocused();
});

test("promotion offers only server choices and submits every underpromotion once", async ({ page }) => {
  await updateFixture(page, "restricted");
  const restricted = await choosePromotion(page);
  await expect(restricted.getByRole("button")).toHaveText(["Rook", "Knight", "Cancel"]);
  await expect(restricted.getByRole("button", { name: "Rook", exact: true })).toBeFocused();
  await restricted.getByRole("button", { name: "Knight", exact: true }).click();
  await expect(page.getByTestId("moves")).toHaveText("a7a8n");
  await expect(page.locator(".board-shell")).toBeFocused();
  await updateFixture(page, "reset");
  for (const [name, expected] of [["Bishop", "a7a8n,a7a8b"], ["Rook", "a7a8n,a7a8b,a7a8r"]]) {
    const dialog = await choosePromotion(page);
    await dialog.getByRole("button", { name, exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("moves")).toHaveText(expected);
    await expect(page.locator(".board-shell")).toBeFocused();
  }
});

test("promotion owns game shortcuts until dismissal and remains inside the viewport", async ({ page }, info) => {
  await page.getByRole("button", { name: "Toggle explanation" }).click();
  await expect(page.getByTestId("explanation")).toHaveText("open");
  const dialog = await choosePromotion(page);
  const expectBoardPlacement = async () => {
    const phone = page.viewportSize()!.width <= 760;
    await expect.poll(async () => {
      const box = (await dialog.boundingBox())!;
      const board = (await page.locator(".board-shell").boundingBox())!;
      return Math.abs(box.x - (board.x + board.width * (phone ? 0.03 : 0.08)));
    }).toBeLessThan(2);
    const box = (await dialog.boundingBox())!;
    const board = (await page.locator(".board-shell").boundingBox())!;
    expect(box.y).toBeCloseTo(board.y + board.height * (phone ? 0.2 : 0.25), 0);
    expect(box.width).toBeCloseTo(board.width * (phone ? 0.94 : 0.84), 0);
  };
  await expectBoardPlacement();
  await page.screenshot({ path: info.outputPath("promotion.png") });
  for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
    await page.keyboard.press(key);
    await expect(page.getByTestId("ply")).toHaveText("1");
    await expect(page.getByTestId("explanation")).toHaveText("open");
  }
  await expect(dialog).toBeInViewport({ ratio: 1 });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await expectBoardPlacement();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("explanation")).toHaveText("open");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("ply")).toHaveText("2");
});

test("drag promotion opens after release and accepts its first underpromotion click", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "The touch board uses the tap promotion contract above.");
  await dragToPromotion(page);
  const hasOpener = await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === document.body) return false;
    active.dataset.modalOpener = "true";
    return true;
  });
  await page.mouse.up();
  const dialog = page.getByRole("dialog", { name: "Choose promotion" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Queen", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Knight", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("moves")).toHaveText("a7a8n");
  await expect(page.locator(hasOpener ? '[data-modal-opener="true"]' : ".board-shell")).toBeFocused();
});

for (const action of ["disable", "position", "unmount"] as const) {
  test(`an open promotion closes safely when the board inputs ${action}`, async ({ page }) => {
    const dialog = await choosePromotion(page);
    await updateFixture(page, action);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("moves")).toBeEmpty();
    await expect(page.locator("[data-legal-destination]")).toHaveCount(0);
    await expect(page.locator("dialog:modal")).toHaveCount(0);
    await page.getByRole("button", { name: "After board", exact: true }).click();
    await expect(page.getByRole("button", { name: "After board", exact: true })).toBeFocused();
    await updateFixture(page, "reset");
    await choosePromotion(page);
  });
}

for (const action of ["disable", "position", "unmount"] as const) {
  test(`a pending drag promotion never opens after board inputs ${action}`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "The touch board uses the tap promotion contract above.");
    await dragToPromotion(page);
    // Commit the caller's update immediately after the real drop, before the
    // chooser's brief delay used to outlast dnd-kit's click suppression.
    await page.evaluate(detail => {
      window.addEventListener("pointerup", () => {
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("modal-fixture-update", { detail })), 0);
      }, { once: true });
    }, action);
    await page.mouse.up();
    await page.waitForTimeout(150);
    await expect(page.getByRole("dialog", { name: "Choose promotion" })).toHaveCount(0);
    await expect(page.getByTestId("moves")).toBeEmpty();
    await expect(page.locator("[data-legal-destination]")).toHaveCount(0);
    await updateFixture(page, "reset");
    await choosePromotion(page);
  });
}

test("evidence contains focus, keeps its board read-only and restores its opener on both close paths", async ({ page }, info) => {
  const opener = page.getByRole("button", { name: "Open evidence", exact: true });
  await page.getByRole("button", { name: "Toggle explanation" }).click();
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Decision evidence" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element instanceof HTMLDialogElement && element.matches(":modal"))).toBe(true);
  const close = dialog.getByRole("button", { name: "Close evidence", exact: true });
  const reject = dialog.getByRole("button", { name: "Reject unsupported classification", exact: true });
  await expect(reject).toBeVisible();
  await page.screenshot({ path: info.outputPath("evidence.png") });
  await expect(close).toBeFocused();
  await tabTo(page, "Shift+Tab", reject);
  await tabTo(page, "Tab", close);
  await dialog.locator('[data-square="a7"]').click();
  await dialog.locator('[data-square="a8"]').click();
  await expect(page.getByRole("dialog", { name: "Choose promotion" })).toHaveCount(0);
  await expect(dialog.locator("[data-legal-destination]")).toHaveCount(0);
  for (const key of ["ArrowLeft", "ArrowRight"]) {
    await page.keyboard.press(key);
    await expect(page.getByTestId("ply")).toHaveText("1");
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(page.getByTestId("explanation")).toHaveText("open");
  await opener.click();
  await expect(close).toBeFocused();
  await close.click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("ply")).toHaveText("0");
});
