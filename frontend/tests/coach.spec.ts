import { test, expect } from "@playwright/test";
import { expressions } from "../src/coach/model";

test("studio offers four male collections, stable previews and expressive reduced motion", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/coach-studio");
  const concepts = page.locator(".studio-concepts .coach-avatar");
  await expect(concepts).toHaveCount(4);
  await expect(concepts.first()).toHaveAttribute(
    "data-expression",
    "brilliant",
  );
  await concepts.first().scrollIntoViewIfNeeded();
  await expect(concepts.first()).toHaveAttribute("data-phase", "reaction");
  await expect(concepts.first()).toHaveAttribute("data-phase", "rest");
  await page.locator(".studio-concepts").screenshot({
    path: `test-results/coach-directions-${info.project.name}.png`,
  });
  await expect(page.locator(".studio-expression")).toHaveCount(20);
  const controls = await page
    .locator(".studio-controls select, .studio-controls button")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      }),
    );
  for (const control of controls) {
    expect(control.width).toBeGreaterThan(100);
    expect(control.height).toBeGreaterThanOrEqual(40);
  }
  for (let left = 0; left < controls.length; left++)
    for (let right = left + 1; right < controls.length; right++) {
      const a = controls[left],
        b = controls[right];
      expect(
        a.x + a.width <= b.x + 1 ||
          b.x + b.width <= a.x + 1 ||
          a.y + a.height <= b.y + 1 ||
          b.y + b.height <= a.y + 1,
      ).toBe(true);
    }
  const geometry = () =>
    page.locator(".studio-concepts").evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    }));
  const initial = await geometry();
  for (const state of expressions) {
    await page
      .getByRole("combobox", { name: "Expression", exact: true })
      .selectOption(state);
    for (const character of await concepts.all())
      await expect(character).toHaveAttribute("data-expression", state);
    expect(await geometry()).toEqual(initial);
  }
  for (const family of ["storyteller", "host", "expert", "partner"]) {
    await page
      .getByRole("combobox", { name: "Collection", exact: true })
      .selectOption(family);
    await expect(
      page.locator(`.studio-expression .coach-avatar[data-family="${family}"]`),
    ).toHaveCount(20);
    await page.locator(".studio-collection").screenshot({
      path: `test-results/coach-collection-${family}-${info.project.name}.png`,
    });
  }
  await page
    .getByRole("combobox", { name: "Expression", exact: true })
    .selectOption("blunder");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(concepts.first()).toHaveAttribute("data-motion", "still");
  await expect(concepts.first()).toHaveAttribute("data-expression", "blunder");
  await expect(
    page.getByRole("checkbox", { name: "Reduced motion" }),
  ).toBeChecked();
  expect(
    await page
      .locator(".coach-avatar")
      .evaluateAll(
        (elements) =>
          elements.flatMap((element) =>
            element.getAnimations({ subtree: true }),
          ).length,
      ),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/coach-studio-${info.project.name}.png`,
    fullPage: true,
  });
});

test("reactions settle, replay midway, skip stale transitions and pause offscreen", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/coach-studio");
  const avatar = page.locator(".studio-storyteller .coach-avatar");
  await expect(avatar).toHaveAttribute("data-expression", "brilliant");
  await page.getByRole("button", { name: "Replay reaction" }).click();
  await expect(avatar).toHaveAttribute("data-phase", "reaction");
  await expect
    .poll(() =>
      avatar
        .locator(".coach-head-motion")
        .evaluate((element) =>
          element
            .getAnimations()
            .some(
              (animation) =>
                animation.playState === "running" &&
                (animation.effect?.getTiming().duration as number) >= 1000,
            ),
        ),
    )
    .toBe(true);
  const take = Number(await avatar.getAttribute("data-take"));
  await page.getByRole("button", { name: "Replay reaction" }).click();
  await expect
    .poll(async () => Number(await avatar.getAttribute("data-take")))
    .toBeGreaterThan(take);
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  await page
    .getByRole("combobox", { name: "Expression", exact: true })
    .selectOption("thinking");
  await page
    .getByRole("combobox", { name: "Expression", exact: true })
    .selectOption("blunder");
  await expect(avatar).toHaveAttribute("data-expression", "blunder");
  await avatar.scrollIntoViewIfNeeded();
  await expect(avatar).toHaveAttribute("data-phase", "reaction");
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  await expect(avatar).toHaveAttribute("data-expression", "blunder");
  const stableTake = await avatar.getAttribute("data-take");
  await page.locator(".studio-note").scrollIntoViewIfNeeded();
  await page.locator(".studio-controls").scrollIntoViewIfNeeded();
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  expect(await avatar.getAttribute("data-take")).toBe(stableTake);
  // Preview a specific microgesture without replaying the main reaction.
  await page
    .getByRole("combobox", { name: "Idle gesture" })
    .selectOption("sigh");
  await page.getByRole("button", { name: "Preview idle" }).click();
  // The controls may scroll the portrait offscreen on a phone; no animation is
  // required there. Returning never celebrates an old move again.
  await page.locator(".studio-controls").scrollIntoViewIfNeeded();
  await page.getByRole("link", { name: "Back to Settings" }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".studio-concepts")).toHaveCount(0);
});

test("coach preference saves, reloads and respects the device across real pages", async ({
  page,
}) => {
  await page.request.put("/api/preferences/coach", {
    data: { coach_id: "classic", motion: "natural" },
  });
  try {
    await page.goto("/settings");
    await expect(page.getByRole("radio")).toHaveCount(4);
    await expect(
      page.getByRole("radio", { name: "Storyteller", exact: true }),
    ).toBeChecked();
    await page
      .getByLabel("Coach motion", { exact: true })
      .selectOption("still");
    await expect(page.getByRole("status")).toContainText("Saved");
    await page.reload();
    await expect(page.getByLabel("Coach motion", { exact: true })).toHaveValue(
      "still",
    );
    await expect(
      page.locator(".coach-option:has(input:checked) .coach-avatar"),
    ).toHaveAttribute("data-motion", "still");
    await page
      .getByLabel("Coach motion", { exact: true })
      .selectOption("natural");
    await expect(page.getByRole("status")).toContainText("Saved");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(
      page.locator(".coach-option:has(input:checked) .coach-avatar"),
    ).toHaveAttribute("data-motion", "still");
    await expect(
      page.getByText(
        "Your device requests reduced motion. The coach will stay still.",
      ),
    ).toBeVisible();
  } finally {
    await page.request.put("/api/preferences/coach", {
      data: { coach_id: "classic", motion: "natural" },
    });
  }
});

test("game navigation and SRS attempts drive the real shared coach", async ({
  page,
}, info) => {
  const { id } = await (
    await page.request.post(
      `/__test/game-review-fixture/coach-${info.project.name}`,
    )
  ).json();
  await page.goto(`/games/${id}?ply=3`);
  const avatar = page.locator(".review-coach .coach-avatar");
  await expect(avatar).toHaveAttribute("data-expression", "blunder", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Last move", exact: true }).click();
  await expect(avatar).toHaveAttribute("data-expression", "losing");
  await expect(page.locator(".coach-message")).toContainText(
    "Your king has no legal escape",
  );
  await page.getByRole("button", { name: "First move", exact: true }).click();
  await expect(avatar).toHaveAttribute("data-expression", "neutral");
  const fixture = await (
    await page.request.post(
      `/__test/review-explanation-fixture/coach-${info.project.name}`,
    )
  ).json();
  await page.goto(`/?exercise=${fixture.exercise_id}`);
  await expect(avatar).toHaveAttribute("data-expression", "neutral");
  const board = page.locator(".board-shell");
  const play = async (uci: string) => {
    await board.locator(`[data-square="${uci.slice(0, 2)}"]`).click();
    await board.locator(`[data-square="${uci.slice(2, 4)}"]`).click();
  };
  await play(fixture.wrong);
  await expect(avatar).toHaveAttribute("data-expression", "mistake");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(avatar).toHaveAttribute("data-expression", "encouraging");
  await play(fixture.best);
  await expect(avatar).toHaveAttribute("data-expression", "recovered");
  await page.getByRole("button", { name: "Show why", exact: true }).click();
  await expect(avatar).toHaveAttribute("data-expression", "explaining");
  await page.screenshot({
    path: `test-results/coach-review-${info.project.name}.png`,
    fullPage: true,
  });
});

test("preference failures keep the last saved choice and allow recovery", async ({
  page,
}) => {
  await page.request.put("/api/preferences/coach", {
    data: { coach_id: "classic", motion: "natural" },
  });
  let failLoad = true;
  let failSave = true;
  await page.route("**/api/preferences/coach", async (route) => {
    const reading = route.request().method() === "GET";
    if ((reading && failLoad) || (!reading && failSave)) {
      if (reading) failLoad = false;
      else failSave = false;
      return route.fulfill({
        status: 503,
        json: {
          detail: reading
            ? "Preferences unavailable"
            : "Preference was not saved",
        },
      });
    }
    return route.continue();
  });
  try {
    await page.goto("/settings");
    const motion = page.getByLabel("Coach motion", { exact: true });
    const status = page.locator(".coach-preference-status");
    await expect(status).toContainText("Preferences unavailable");
    await expect(motion).toBeDisabled();
    await expect(
      page.locator(".coach-option:has(input:checked) .coach-avatar"),
    ).toHaveAttribute("data-motion", "still");
    await page.getByRole("button", { name: "Reload preferences" }).click();
    await expect(motion).toBeEnabled();
    await expect(motion).toHaveValue("natural");
    await page.getByRole("button", { name: "Cats", exact: true }).click();
    const cat = page.getByRole("radio", { name: "Velvet night", exact: true });
    await cat.click();
    await expect(status).toContainText("Preference was not saved");
    await expect(cat).not.toBeChecked();
    await expect(motion).toHaveValue("natural");
    expect(
      await (await page.request.get("/api/preferences/coach")).json(),
    ).toEqual({ coach_id: "classic", motion: "natural" });
    await cat.click();
    await expect(cat).toBeChecked();
    await expect(motion).toBeEnabled();
    await motion.selectOption("still");
    await expect(status).toContainText("Saved");
    await page.reload();
    await expect(motion).toHaveValue("still");
    await expect(cat).toBeChecked();
  } finally {
    await page.request.put("/api/preferences/coach", {
      data: { coach_id: "classic", motion: "natural" },
    });
  }
});

test("connecting with a LAN token restores preferences without a page reload", async ({
  page,
}) => {
  await page.route("**/api/preferences/coach", (route) =>
    route.request().headers().authorization === "Bearer coach-test-token"
      ? route.fulfill({ json: { coach_id: "classic", motion: "still" } })
      : route.fulfill({ status: 401, json: { detail: "LAN token required" } }),
  );
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Connect to your workspace" }),
  ).toBeVisible();
  await page
    .getByLabel("Access token", { exact: true })
    .fill("coach-test-token");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  const motion = page.getByLabel("Coach motion", { exact: true });
  await expect(motion).toBeEnabled();
  await expect(motion).toHaveValue("still");
  await expect(
    page.locator(".coach-option:has(input:checked) .coach-avatar"),
  ).toHaveAttribute("data-motion", "still");
  await expect(
    page.getByRole("button", { name: "Reload preferences" }),
  ).toHaveCount(0);
});
