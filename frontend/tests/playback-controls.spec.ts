import { expect, test, type Locator } from "@playwright/test";
import type { Schema } from "../src/api";

async function geometry(controls: Locator) {
  return controls.evaluate(element =>
    Array.from(element.querySelectorAll("button, .move-playback-counter"), child => {
      const rect = child.getBoundingClientRect();
      return {
        x: rect.x - element.getBoundingClientRect().x,
        width: rect.width,
        height: rect.height,
      };
    }),
  );
}

test("shared move playback preserves counter geometry and fits the complete game toolbar on phones", async ({
  page,
}, info) => {
  const fixture = await page.request.post(
    `/__test/game-review-fixture/playback-controls-${info.project.name}`,
  );
  expect(fixture.ok()).toBe(true);
  const { id } = await fixture.json();
  // Exercise the real navigation without requiring any engine searches.
  await page.route(`**/api/games/${id}/review`, route =>
    route.fulfill({ json: { job_id: "playback-controls", status: "completed" } }),
  );
  await page.route(`**/api/games/${id}/analyze`, route =>
    route.fulfill({ json: { report: null, score: null, best_move: null } }),
  );
  await page.goto(`/games/${id}?ply=2`);
  const gameControls = page.getByRole("group", { name: "Game move playback", exact: true });
  await expect(gameControls.locator(".move-playback-counter")).toHaveText("2 / 4");
  await page.evaluate(() => document.fonts.ready);
  const nextSize = (await gameControls
    .getByRole("button", { name: "Next move", exact: true })
    .boundingBox())!;

  const toolbar = page.getByRole("group", { name: "Game navigation", exact: true });
  const completeToolbar = page.locator(".review-board-toolbar");
  for (const width of [320, 350, 360, 375, 390, 760]) {
    await page.setViewportSize({ width, height: 700 });
    await completeToolbar.scrollIntoViewIfNeeded();
    const bounds = await completeToolbar.evaluate(element => {
      const row = element.getBoundingClientRect();
      const controls = Array.from(
        element.querySelectorAll("a, button, .move-playback-counter"),
        control => {
          const rect = control.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
            isAction: control.matches("a, button"),
          };
        },
      );
      return { left: row.left, right: row.right, top: row.top, bottom: row.bottom, controls };
    });
    for (const [index, control] of bounds.controls.entries()) {
      expect(control.left).toBeGreaterThanOrEqual(bounds.left - 1);
      expect(control.right).toBeLessThanOrEqual(bounds.right + 1);
      expect(control.top).toBeGreaterThanOrEqual(bounds.top);
      expect(control.bottom).toBeLessThanOrEqual(bounds.bottom);
      if (control.isAction) expect(control.height).toBe(44);
      for (const previous of bounds.controls.slice(0, index)) {
        expect(
          control.left >= previous.right - 1 ||
            control.right <= previous.left + 1 ||
            control.top >= previous.bottom - 1 ||
            control.bottom <= previous.top + 1,
        ).toBe(true);
      }
    }
    // Flip starts the row and quick mute ends it, either side of the move controls, sized alike.
    const mute = (await toolbar
      .getByRole("button", { name: "Mute sound on this device", exact: true })
      .boundingBox())!;
    const flip = (await toolbar
      .getByRole("button", { name: "Flip board", exact: true })
      .boundingBox())!;
    const navigationBox = (await toolbar.boundingBox())!;
    expect(mute.y).toBe(flip.y);
    expect(mute.width).toBeCloseTo(flip.width, 0);
    expect(flip.x).toBeCloseTo(navigationBox.x, 1);
    expect(mute.x + mute.width).toBeCloseTo(navigationBox.x + navigationBox.width, 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await toolbar.getByRole("button", { name: "Start of game", exact: true }).click();
  await expect(gameControls.locator(".move-playback-counter")).toHaveText("0 / 4");
  await expect(toolbar.getByRole("button", { name: "Previous move", exact: true })).toBeDisabled();
  await toolbar.getByRole("button", { name: "Last move", exact: true }).click();
  await expect(gameControls.locator(".move-playback-counter")).toHaveText("4 / 4");
  // The page keys mirror the playback buttons: arrows step, Home and End jump.
  // Up/Down and A/D are Chess.com's equivalents.
  for (const [key, shown] of [
    ["Home", "0 / 4"],
    ["ArrowRight", "1 / 4"],
    ["ArrowRight", "2 / 4"],
    ["ArrowLeft", "1 / 4"],
    ["End", "4 / 4"],
    ["ArrowUp", "0 / 4"],
    ["d", "1 / 4"],
    ["D", "2 / 4"],
    ["a", "1 / 4"],
    ["ArrowDown", "4 / 4"],
  ]) {
    await page.keyboard.press(key);
    await expect(gameControls.locator(".move-playback-counter")).toHaveText(shown);
  }

  await page.setViewportSize(info.project.use.viewport!);
  const response = await page.request.get("/api/openings/catalog?q=Italian%20Game&limit=50");
  expect(response.ok()).toBe(true);
  const catalogue: Schema["OpeningCatalogue"] = await response.json();
  const line = catalogue.items.find(item => item.plies >= 12);
  expect(line).toBeTruthy();
  await page.goto(`/study/openings/catalogue/${encodeURIComponent(line!.source_key)}`);
  const openingControls = page.getByRole("group", { name: "Opening line playback", exact: true });
  const counter = openingControls.locator(".move-playback-counter");
  await expect(counter).toHaveText(`0 / ${line!.plies}`);
  const next = openingControls.getByRole("button", { name: "Next line move", exact: true });
  const openingSize = (await next.boundingBox())!;
  expect(openingSize.height).toBe(nextSize.height);
  if (info.project.name === "desktop") expect(openingSize.width).toBe(nextSize.width);
  await page
    .getByRole("group", { name: "Opening continuation", exact: true })
    .getByRole("button")
    .nth(9)
    .click();
  await expect(counter).toHaveText(`9 / ${line!.plies}`);
  const before = await geometry(openingControls);
  await next.click();
  await expect(counter).toHaveText(`10 / ${line!.plies}`);
  expect(await geometry(openingControls)).toEqual(before);
  await openingControls.getByRole("button", { name: "Previous line move", exact: true }).click();
  await expect(counter).toHaveText(`9 / ${line!.plies}`);
  await page.keyboard.press("ArrowRight");
  await expect(counter).toHaveText(`10 / ${line!.plies}`);
  await page.keyboard.press("ArrowLeft");
  await expect(counter).toHaveText(`9 / ${line!.plies}`);
  // The opening preview shows no first/last buttons, so Home and End stay the page's.
  await page.keyboard.press("Home");
  await expect(counter).toHaveText(`9 / ${line!.plies}`);
});

test("the board takes Chess.com's right-click marks and X flips it", async ({ page }, info) => {
  const fixture = await page.request.post(
    `/__test/game-review-fixture/board-marks-${info.project.name}`,
  );
  expect(fixture.ok()).toBe(true);
  const { id } = await fixture.json();
  await page.route(`**/api/games/${id}/review`, route =>
    route.fulfill({ json: { job_id: "board-marks", status: "completed" } }),
  );
  await page.route(`**/api/games/${id}/analyze`, route =>
    route.fulfill({ json: { report: null, score: null, best_move: null } }),
  );
  await page.goto(`/games/${id}?ply=2`);
  const board = page.locator(".board-shell");
  const square = (name: string) => board.locator(`[data-square="${name}"] .board-square-content`);
  await expect(
    page
      .getByRole("group", { name: "Game move playback", exact: true })
      .locator(".move-playback-counter"),
  ).toHaveText("2 / 4");
  const menus: string[] = [];
  await page.exposeFunction("contextMenuShown", (prevented: boolean) =>
    menus.push(String(prevented)),
  );
  await page.evaluate(() =>
    addEventListener("contextmenu", event =>
      setTimeout(() =>
        (window as unknown as { contextMenuShown: (prevented: boolean) => void }).contextMenuShown(
          event.defaultPrevented,
        ),
      ),
    ),
  );

  await square("e4").click({ button: "right" });
  await expect(square("e4")).toHaveAttribute("data-mark", "red");
  await square("d4").click({ button: "right", modifiers: ["Shift"] });
  await expect(square("d4")).toHaveAttribute("data-mark", "green");
  await square("c4").click({ button: "right", modifiers: ["Alt"] });
  await expect(square("c4")).toHaveAttribute("data-mark", "blue");
  await square("f4").click({ button: "right", modifiers: ["Control"] });
  await expect(square("f4")).toHaveAttribute("data-mark", "yellow");
  // The same click again removes a mark; another colour replaces it.
  await square("e4").click({ button: "right" });
  await expect(square("e4")).not.toHaveAttribute("data-mark");
  await square("d4").click({ button: "right" });
  await expect(square("d4")).toHaveAttribute("data-mark", "red");
  await expect.poll(() => menus.length).toBeGreaterThan(0);
  expect(menus.every(prevented => prevented === "true")).toBe(true);

  // Right-drag draws an arrow rather than a mark.
  const from = (await board.locator('[data-square="g1"]').boundingBox())!;
  const to = (await board.locator('[data-square="g3"]').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 4 });
  await page.mouse.up({ button: "right" });
  await expect(board.locator("svg path[marker-end]")).toHaveCount(1);
  await expect(square("g1")).not.toHaveAttribute("data-mark");

  // A left click on the board clears marks and arrows.
  await square("a3").click();
  await expect(board.locator("[data-mark]")).toHaveCount(0);
  await expect(board.locator("svg path[marker-end]")).toHaveCount(0);

  // Marks belong to their position.
  await square("e4").click({ button: "right" });
  await expect(square("e4")).toHaveAttribute("data-mark", "red");
  await page.keyboard.press("ArrowRight");
  await expect(board.locator("[data-mark]")).toHaveCount(0);

  const a1 = async () => (await board.locator('[data-square="a1"]').boundingBox())!.y;
  const before = await a1();
  await page.keyboard.press("x");
  await expect.poll(a1).toBeLessThan(before);
  await page.keyboard.press("X");
  await expect.poll(a1).toBe(before);
});
