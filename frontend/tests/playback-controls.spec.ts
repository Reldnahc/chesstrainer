import { expect, test } from "./helpers/browserTest";

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
