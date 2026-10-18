import { expect, test, type Locator, type Page } from "./helpers/browserTest";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, transformWithEsbuild, type ViteDevServer } from "vite";
import { devRecordingAssets } from "../vite.shared";
import { isolatedServer } from "./helpers/vite";

// Real production components in a small browser fixture allow changes to board
// inputs while a modal is open, without coupling these contracts to an engine.
const harness = `
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Board from "/src/Board.tsx";
import "/src/foundation.css";
import "/src/base.css";
import "/src/board.css";

const initialFen = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1";
const changedFen = "4k3/8/P7/8/8/8/8/4K3 w - - 0 2";

function Fixture() {
  const [fen, setFen] = useState(initialFen);
  const [choices, setChoices] = useState(["q", "r", "b", "n"]);
  const [moves, setMoves] = useState([]);
  useEffect(() => {
    const update = event => {
      if (event.detail === "position") setFen(changedFen);
      if (event.detail === "restricted") setChoices(["r", "n"]);
      if (event.detail === "reset") {
        setFen(initialFen);
        setChoices(["q", "r", "b", "n"]);
      }
    };
    window.addEventListener("modal-fixture-update", update);
    return () => window.removeEventListener("modal-fixture-update", update);
  }, []);
  return <div style={{padding: 16, maxWidth: 512}}>
    <output data-testid="moves">{moves.join(",")}</output>
    <Board fen={fen} orientation="white"
      legalMoves={choices.map(promotion => ({from_square: "a7", to_square: "a8", promotion, capture: false}))}
      onMove={(from, to, promotion) => setMoves(values => [...values, from + to + promotion])} />
    <button>After board</button>
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
    plugins: [
      react(),
      devRecordingAssets(),
      {
        name: "modal-contract-fixture",
        resolveId(id) {
          if (id === "/modal-contract.tsx") return "\0modal-contract.tsx";
        },
        async load(id) {
          if (id === "\0modal-contract.tsx")
            return (
              await transformWithEsbuild(harness, "modal-contract.tsx", {
                loader: "tsx",
                jsx: "automatic",
              })
            ).code;
        },
        configureServer(vite) {
          // eslint-disable-next-line @typescript-eslint/no-misused-promises -- the handler catches every failure and passes it to next
          vite.middlewares.use("/__modal-contract", async (_request, response, next) => {
            try {
              const html = await vite.transformIndexHtml(
                "/__modal-contract",
                `<!doctype html>
              <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
              <body><div id="root"></div><script type="module" src="/modal-contract.tsx"></script></body></html>`,
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
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${origin}__modal-contract`);
  await expect(page.locator(".board-shell")).toBeVisible();
});

async function updateFixture(page: Page, action: "position" | "restricted" | "reset") {
  await page.evaluate(
    detail => window.dispatchEvent(new CustomEvent("modal-fixture-update", { detail })),
    action,
  );
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
    if (nativeStop === "chrome") expect(await page.evaluate(() => document.hasFocus())).toBe(false);
    else if (nativeStop === "dialog")
      expect(
        await page.evaluate(() => {
          const active = document.activeElement!;
          return active.scrollHeight > active.clientHeight;
        }),
      ).toBe(true);
    else break;
    await page.keyboard.press(direction);
  }
  await expect(target).toBeFocused();
}

test("promotion is a native modal with contained focus and Escape restores the board", async ({
  page,
}) => {
  const dialog = await choosePromotion(page);
  expect(
    await dialog.evaluate(
      element => element instanceof HTMLDialogElement && element.matches(":modal"),
    ),
  ).toBe(true);
  const first = dialog.getByRole("button", { name: "Queen", exact: true });
  const last = dialog.getByRole("button", { name: "Cancel", exact: true });
  await expect(first).toBeFocused();
  await page
    .getByRole("button", { name: "After board", exact: true })
    .evaluate(element => element.focus());
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

test("promotion offers only server choices and submits every underpromotion once", async ({
  page,
}) => {
  await updateFixture(page, "restricted");
  const restricted = await choosePromotion(page);
  await expect(restricted.getByRole("button")).toHaveText(["Rook", "Knight", "Cancel"]);
  await expect(restricted.getByRole("button", { name: "Rook", exact: true })).toBeFocused();
  await restricted.getByRole("button", { name: "Knight", exact: true }).click();
  await expect(page.getByTestId("moves")).toHaveText("a7a8n");
  await expect(page.locator(".board-shell")).toBeFocused();
  await updateFixture(page, "reset");
  for (const [name, expected] of [
    ["Bishop", "a7a8n,a7a8b"],
    ["Rook", "a7a8n,a7a8b,a7a8r"],
  ]) {
    const dialog = await choosePromotion(page);
    await dialog.getByRole("button", { name, exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("moves")).toHaveText(expected);
    await expect(page.locator(".board-shell")).toBeFocused();
  }
});

test("drag promotion opens after release and accepts its first underpromotion click", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "The touch board uses the tap promotion contract above.",
  );
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
  await expect(
    page.locator(hasOpener ? '[data-modal-opener="true"]' : ".board-shell"),
  ).toBeFocused();
});

// A stale move after a position change is the case that matters; disabling and
// unmounting the board share its path.
test("an open promotion closes safely when the board inputs position", async ({ page }) => {
  const dialog = await choosePromotion(page);
  await updateFixture(page, "position");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("moves")).toBeEmpty();
  await expect(page.locator("[data-legal-destination]")).toHaveCount(0);
  await expect(page.locator("dialog:modal")).toHaveCount(0);
  await page.getByRole("button", { name: "After board", exact: true }).click();
  await expect(page.getByRole("button", { name: "After board", exact: true })).toBeFocused();
  await updateFixture(page, "reset");
  await choosePromotion(page);
});

test("a pending drag promotion never opens after board inputs position", async ({ page }, info) => {
  test.skip(
    info.project.name !== "desktop",
    "The touch board uses the tap promotion contract above.",
  );
  await dragToPromotion(page);
  // Commit the caller's update immediately after the real drop, before the
  // chooser's brief delay used to outlast dnd-kit's click suppression.
  await page.evaluate(detail => {
    window.addEventListener(
      "pointerup",
      () => {
        window.setTimeout(
          () => window.dispatchEvent(new CustomEvent("modal-fixture-update", { detail })),
          0,
        );
      },
      { once: true },
    );
  }, "position");
  await page.mouse.up();
  await page.waitForTimeout(150);
  await expect(page.getByRole("dialog", { name: "Choose promotion" })).toHaveCount(0);
  await expect(page.getByTestId("moves")).toBeEmpty();
  await expect(page.locator("[data-legal-destination]")).toHaveCount(0);
  await updateFixture(page, "reset");
  await choosePromotion(page);
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) ?? [], "uncaught page errors").toEqual([]);
});
